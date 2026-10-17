import concurrent.futures
import http.client
import importlib.util
import io
from types import SimpleNamespace
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import zipfile
from unittest import mock

ROOT = Path(os.environ.get('NODERUNNER_SOURCE', os.environ.get('HNS_SOURCE', Path(__file__).resolve().parents[1])))
spec = importlib.util.spec_from_file_location('hns', ROOT / 'noderunner.py')
hns = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hns)

class ValidationTests(unittest.TestCase):
    def test_room_grid_size_round_trip_and_invalid_values(self):
        for side in (2, 3, 4):
            data = {'config': {'rooms': {'room': {'label': 'Room', 'gridSize': side}}}}
            clean = hns.validate_assignments(data)
            self.assertEqual(hns.validate_assignments(clean)['config']['rooms']['room']['gridSize'], side)
        for side in (True, False, None, '2', 1, 5, 2.5, [], {}):
            with self.subTest(side=side), self.assertRaises(ValueError):
                hns.validate_assignments({'config': {'rooms': {'room': {'gridSize': side}}}})

    def test_optional_existing_data_is_compatible(self):
        # Read only; never rewrite the user's registry.
        self.assertIsInstance(hns.load_assignments()['overrides'], dict)

    def test_valid_target_is_canonicalized(self):
        self.assertEqual(hns.scan_target('192.168.1.45/24'), '192.168.1.0/24')
        self.assertEqual(hns.scan_target('192.168.1.45'), '192.168.1.45/32')

    def test_target_cannot_be_an_nmap_option_or_ipv6(self):
        for target in ['--script=evil', '-iL/tmp/targets', '192.168.1.0/24 -A', '::/0', '', None, 42]:
            with self.subTest(target=target), self.assertRaises(ValueError):
                hns.run_nmap(target)

    def test_malformed_shapes_and_flags_are_rejected(self):
        bad = [[], {'overrides': []}, {'known': []}, {'config': []}, {'baseline': 'true'},
               {'overrides': {'x': None}}, {'overrides': {'x': {'trusted': 'false'}}},
               {'config': {'rooms': {'a': None}}}, {'config': {'customVendors': [None]}},
               {'overrides': {'x': {'pos': {'xPct': 101, 'yPct': 1}}}},
               {'overrides': {'x': {'lastPorts': ['80']}}},
               {'known': {'x': float('nan')}}, {'known': {'x': 10**400}},
               {'overrides': {'x': {'pos': {'xPct': 10**400, 'yPct': 1}}}}]
        for value in bad:
            with self.subTest(value=str(value)[:100]), self.assertRaises(ValueError):
                hns.validate_assignments(value)

    def test_reserved_keys_rejected_in_all_maps(self):
        for key in ['__proto__', 'constructor', 'prototype']:
            for value in [{'overrides': {key: {}}}, {'known': {key: 1}},
                          {'config': {'rooms': {key: {'label': 'x'}}}},
                          {'config': {'customTypes': {key: {'label': 'x'}}}}]:
                with self.subTest(value=value), self.assertRaises(ValueError):
                    hns.validate_assignments(value)

    def test_legacy_room_layout_and_positions_survive(self):
        result = hns.validate_assignments({'overrides': {'x': {'pos': {'xPct': 25, 'yPct': 50}}},
            'config': {'rooms': {'a': {'label': 'Room', 'x': 0, 'y': 0, 'w': 10, 'h': 10}}}})
        self.assertEqual(result['overrides']['x']['pos']['xPct'], 25)
        self.assertEqual(result['config']['rooms']['a'], {'label': 'Room'})
        self.assertNotIn('rooms', hns.validate_assignments({})['config'])
        self.assertEqual(hns.validate_assignments({'config': {'rooms': {}}})['config']['rooms'], {})

    def test_svg_drops_scripts_handlers_and_external_paint(self):
        source = '<script>alert(1)</script><path onload="evil()" fill="url(https://evil/x)" stroke="currentColor" d="M0 0"/>'
        clean = hns.sanitize_icon_svg(source)
        for bad in ['script', 'onload', 'url(', 'https:']:
            self.assertNotIn(bad, clean)
        self.assertIn('currentColor', clean)
        for value in [[], 4, None, '<!DOCTYPE svg><path/>', '<?xml version="1.0"?>']:
            self.assertEqual(hns.sanitize_icon_svg(value), '')
        hns.sanitize_icon_svg('<g>' * 1500 + '<path/>' + '</g>' * 1500)

    def test_nmap_failures_are_not_empty_success(self):
        for error in [subprocess.CalledProcessError(1, ['nmap'], output='<nmaprun/>'),
                      subprocess.TimeoutExpired(['nmap'], 600), FileNotFoundError()]:
            with mock.patch.object(hns.subprocess, 'check_output', side_effect=error), self.assertRaises(hns.ScanError):
                hns.run_nmap('192.168.1.0/24')
        for xml in ['broken', '<wrong/>', '<nmaprun><runstats><finished exit="error"/></runstats></nmaprun>']:
            with mock.patch.object(hns.subprocess, 'check_output', return_value=xml), self.assertRaises(hns.ScanError):
                hns.run_nmap('192.168.1.0/24')

    def test_successful_empty_scan_is_distinct(self):
        with mock.patch.object(hns.subprocess, 'check_output', return_value='<nmaprun/>'):
            self.assertEqual(hns.run_nmap('192.168.1.0/24'), [])

    def test_gateway_is_not_falsely_reported_online(self):
        with mock.patch.object(hns, 'default_gateway', return_value='192.168.1.1'), mock.patch.object(hns, 'run_nmap', return_value=[]):
            self.assertEqual(hns.scan('192.168.1.0/24')['gateway']['status'], 'unknown')
            self.assertIsNone(hns.scan('10.0.0.0/24')['gateway'])

class ExcelExportTests(unittest.TestCase):
    def test_workbook_structure_and_untrusted_text(self):
        row = ['Yes', 'Seen in scan', '=1+1', 'Caffè & <office>', '192.0.2.1', '00:11:22:33:44:55',
               '+vendor', '@type', '-room', 'Wired', '22, 80', '', 'No', 'No']
        with zipfile.ZipFile(io.BytesIO(hns.registry_xlsx([row]))) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(len(archive.namelist()), 6)
            for name in archive.namelist():
                hns.ET.fromstring(archive.read(name))
            sheet = hns.ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            cells = sheet.findall('s:sheetData/s:row', ns)[1].findall('s:c', ns)
            self.assertEqual([cell.find('s:is/s:t', ns).text or '' for cell in cells], row)
            self.assertTrue(all(cell.get('t') == 'inlineStr' for cell in cells))
            self.assertEqual(sheet.findall('.//s:f', ns), [])
            self.assertEqual(sheet.find('s:autoFilter', ns).get('ref'), 'A1:N2')
            self.assertEqual(sheet.find('s:sheetViews/s:sheetView/s:pane', ns).get('state'), 'frozen')
            self.assertNotIn(b'TargetMode="External"', archive.read('xl/_rels/workbook.xml.rels'))

    def test_empty_export_and_xml_control_characters(self):
        for rows in [[], [['a\x00b\ud800_x0041_'] + [''] * 13]]:
            with zipfile.ZipFile(io.BytesIO(hns.registry_xlsx(rows))) as archive:
                xml = archive.read('xl/worksheets/sheet1.xml')
                hns.ET.fromstring(xml)
                self.assertNotIn(b'\x00', xml)
                if rows:
                    self.assertIn(b'ab_x005F_x0041_', xml)

    def test_export_rejects_malformed_and_oversized_rows(self):
        for rows in [None, {}, [None], [['x']], [[1] * 14], [['\U0001f600' * 17000] + [''] * 13], [[''] * 14] * 10001]:
            with self.subTest(kind=type(rows).__name__), self.assertRaises(ValueError):
                hns.registry_xlsx(rows)


class InstallationPathTests(unittest.TestCase):
    def test_bind_address_validation_before_startup(self):
        with mock.patch('sys.argv', ['noderunner', '--bind', '127.0.0.1']), \
                mock.patch.object(hns, 'backup_assignments', side_effect=RuntimeError('stop before scan')):
            with self.assertRaisesRegex(RuntimeError, 'stop before scan'):
                hns.main()
        for address in ('::1', 'localhost', '127.0.0.1 --script=x'):
            with mock.patch('sys.argv', ['noderunner', '--bind', address]), \
                    mock.patch('sys.stderr', new_callable=io.StringIO), \
                    mock.patch.object(hns, 'backup_assignments') as backup:
                with self.assertRaises(SystemExit) as error:
                    hns.main()
                self.assertEqual(error.exception.code, 2)
                backup.assert_not_called()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.paths = mock.patch.multiple(hns, **{
            key: getattr(hns, key)
            for key in ['ASSIGN_FILE', 'TOKEN_FILE', 'ASSETS_DIR', 'STATIC_DIR']})
        self.paths.start()
        self.addCleanup(self.paths.stop)

    def test_separate_assets_state_and_legacy_token_survive_restart(self):
        assets = self.root / 'share'
        (assets / 'static').mkdir(parents=True)
        (assets / 'NodeRunner.html').write_text('test UI')
        data = self.root / 'state'
        data.mkdir(mode=0o700)
        (data / 'hns_token.txt').write_text('a' * 32)
        original_assets = sorted(assets.rglob('*'))
        hns.configure_paths(str(data), str(assets))
        hns.save_assignments({'config': {'scanTarget': '192.0.2.0/24'}})
        hns.backup_assignments()
        self.assertEqual(hns.load_or_create_token(), 'a' * 32)
        hns.configure_paths(str(data), str(assets))
        self.assertEqual(hns.load_assignments()['config']['scanTarget'], '192.0.2.0/24')
        self.assertEqual(hns.find_html(None), str(assets / 'NodeRunner.html'))
        self.assertEqual(hns.STATIC_DIR, str(assets / 'static'))
        self.assertEqual(len(list(data.glob('assignments.json.bak.*'))), 1)
        self.assertFalse((data / 'noderunner_token.txt').exists())
        self.assertEqual(sorted(assets.rglob('*')), original_assets)

    def test_source_defaults_and_private_directory_creation(self):
        data = self.root / 'private'
        hns.configure_paths(str(data))
        self.assertEqual(data.stat().st_mode & 0o777, 0o700)
        self.assertEqual(hns.TOKEN_FILE, str(data / 'noderunner_token.txt'))
        hns.configure_paths()
        self.assertEqual(hns.ASSIGN_FILE, str(ROOT / 'assignments.json'))
        self.assertEqual(hns.find_html(None), str(ROOT / 'NodeRunner.html'))

    def test_invalid_assets_fail_before_creating_or_switching_state(self):
        previous = hns.ASSIGN_FILE
        data = self.root / 'unused'
        with self.assertRaises(ValueError):
            hns.configure_paths(str(data), str(self.root / 'missing'))
        self.assertFalse(data.exists())
        self.assertEqual(hns.ASSIGN_FILE, previous)

    def test_cli_paths_override_environment_before_storage_access(self):
        data = self.root / 'selected'
        env_data = self.root / 'environment'
        env_assets = self.root / 'assets'
        (env_assets / 'static').mkdir(parents=True)
        (env_assets / 'NodeRunner.html').write_text('environment UI')
        with mock.patch.dict(os.environ, {'NODERUNNER_DATA_DIR': str(env_data),
                                         'NODERUNNER_ASSETS_DIR': str(env_assets)}), \
                mock.patch('sys.argv', ['noderunner']), \
                mock.patch.object(hns, 'backup_assignments', side_effect=RuntimeError('stop before scan')):
            with self.assertRaisesRegex(RuntimeError, 'stop before scan'):
                hns.main()
        self.assertEqual(hns.ASSIGN_FILE, str(env_data / 'assignments.json'))
        self.assertEqual(hns.find_html(None), str(env_assets / 'NodeRunner.html'))
        with mock.patch.dict(os.environ, {'NODERUNNER_DATA_DIR': str(self.root / 'ignored')}), \
                mock.patch('sys.argv', ['noderunner', '--data-dir', str(data)]), \
                mock.patch.object(hns, 'backup_assignments', side_effect=RuntimeError('stop before scan')):
            with self.assertRaisesRegex(RuntimeError, 'stop before scan'):
                hns.main()
        self.assertEqual(hns.ASSIGN_FILE, str(data / 'assignments.json'))
        self.assertFalse((self.root / 'ignored').exists())


class StorageFixture:

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        self.assign = mock.patch.object(hns, 'ASSIGN_FILE', str(self.path/'assignments.json'))
        self.token = mock.patch.object(hns, 'TOKEN_FILE', str(self.path/'hns_token.txt'))
        self.assign.start(); self.token.start()
    def tearDown(self):
        self.assign.stop(); self.token.stop(); self.tmp.cleanup()

class StorageTests(StorageFixture, unittest.TestCase):
    def test_save_does_not_follow_predictable_temp_symlink(self):
        victim = self.path/'victim'; victim.write_text('keep')
        (self.path/'assignments.json.tmp').symlink_to(victim)
        hns.save_assignments({})
        self.assertEqual(victim.read_text(), 'keep')
        self.assertEqual((self.path/'assignments.json').stat().st_mode & 0o777, 0o600)
        self.assertEqual(list(self.path.glob('.noderunner-*.tmp')), [])

    def test_corrupt_registry_is_not_silently_emptied(self):
        (self.path/'assignments.json').write_text('{broken')
        with self.assertRaises(ValueError): hns.load_assignments()
        self.assertEqual((self.path/'assignments.json').read_text(), '{broken')

    def test_token_path_preserves_legacy_secret_and_new_install_name(self):
        directory = str(self.path)
        current = self.path / 'noderunner_token.txt'
        legacy = self.path / 'hns_token.txt'
        self.assertEqual(hns.token_file(directory), str(current))
        legacy.write_text('legacy-secret')
        self.assertEqual(hns.token_file(directory), str(legacy))
        self.assertEqual(legacy.read_text(), 'legacy-secret')
        current.write_text('current-secret')
        self.assertEqual(hns.token_file(directory), str(current))
        current.unlink()
        legacy.unlink()
        legacy.symlink_to(self.path / 'missing-secret')
        self.assertEqual(hns.token_file(directory), str(legacy))

    def test_private_token_is_stable(self):
        token = hns.load_or_create_token()
        self.assertEqual(len(token), 32)
        self.assertEqual(token, hns.load_or_create_token())
        self.assertEqual((self.path/'hns_token.txt').stat().st_mode & 0o777, 0o600)

    def test_token_symlink_is_refused(self):
        if not hasattr(os, 'O_NOFOLLOW'): self.skipTest('O_NOFOLLOW unavailable')
        victim=self.path/'victim'; victim.write_text('a'*32)
        (self.path/'hns_token.txt').symlink_to(victim)
        with self.assertRaises(OSError): hns.load_or_create_token()
        self.assertEqual(victim.read_text(), 'a'*32)

    def test_invalid_token_is_not_rotated(self):
        token=self.path/'hns_token.txt'; token.write_text('bad')
        with self.assertRaises(ValueError): hns.load_or_create_token()
        self.assertEqual(token.read_text(), 'bad')

class FakeSocket:
    def __init__(self, raw):
        self.input = io.BytesIO(raw)
        self.output = bytearray()
    def makefile(self, *args): return self.input
    def settimeout(self, timeout): pass
    def sendall(self, data): self.output.extend(data)

class HTTPTests(StorageFixture, unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.state=hns.State('192.168.1.0/24', False, 30, str(ROOT/'NodeRunner.html'))
        self.state.cache={'devices':[], 'gateway':None, 'count':0, 'ts':123, 'subnet':self.state.target}
        self.handler=hns.make_handler(self.state,'test-token')
    def request(self,method,path,body=None,headers=None,auth=True):
        headers=dict(headers or {})
        if auth: headers['X-NodeRunner-Token']='test-token'
        body = (body or '').encode('utf-8')
        if method == 'POST' and 'Content-Length' not in headers: headers['Content-Length'] = str(len(body))
        raw=('%s %s HTTP/1.0\r\nHost: localhost\r\n' % (method,path)).encode()
        raw += ''.join('%s: %s\r\n' % item for item in headers.items()).encode('latin-1')
        connection=FakeSocket(raw+b'\r\n'+body)
        self.handler(connection, ('127.0.0.1',1234), SimpleNamespace())
        response=http.client.HTTPResponse(FakeSocket(connection.output)); response.begin()
        return response.status, dict(response.getheaders()), response.read()

    def test_all_api_routes_require_authentication(self):
        for route in ['/api/devices','/api/scan','/api/assignments','/api/config','/api/export.xlsx']:
            for method in ['GET','POST']:
                self.assertEqual(self.request(method,route,auth=False)[0],403)
        self.assertEqual(self.request('GET','/api/devices',headers={'X-HNS-Token':'\xe9'},auth=False)[0],403)

    def test_legacy_authentication_and_new_header_precedence(self):
        route = '/api/devices'
        self.assertEqual(self.request('GET',route,headers={'X-HNS-Token':'test-token'},auth=False)[0],200)
        self.assertEqual(self.request('GET',route,headers={'X-HNS-Token':'wrong'},auth=False)[0],403)
        headers = {'X-HNS-Token':'test-token','X-NodeRunner-Token':'wrong'}
        self.assertEqual(self.request('GET',route,headers=headers,auth=False)[0],403)
        headers['X-NodeRunner-Token'] = ''
        self.assertEqual(self.request('GET',route,headers=headers,auth=False)[0],403)
        headers['X-NodeRunner-Token'] = 'test-token'
        self.assertEqual(self.request('GET',route,headers=headers,auth=False)[0],200)
        status, headers, _ = self.request('OPTIONS',route,auth=False)
        self.assertEqual(status,204)
        self.assertIn('X-NodeRunner-Token',headers['Access-Control-Allow-Headers'])
        self.assertIn('X-HNS-Token',headers['Access-Control-Allow-Headers'])

    def test_noderunner_ui_assets_and_legacy_entry_points(self):
        import xml.etree.ElementTree as ET
        for route in ['/', '/index.html', '/NodeRunner.html', '/HomeNetScanner.html']:
            status, _, body = self.request('GET',route,auth=False)
            self.assertEqual(status,200)
            self.assertIn(b'<title>NodeRunner</title>',body)
            self.assertNotIn(b'HomeNetScanner',body)
            self.assertIn(b'static/branding/icon-96.webp',body)
        for route in ['/static/noderunner.svg','/static/noderunner-mask.svg']:
            status, headers, body = self.request('GET',route,auth=False)
            self.assertEqual(status,200)
            self.assertEqual(headers['Content-Type'],'image/svg+xml')
            ET.fromstring(body)
        status, _, body = self.request('GET','/static/manifest.webmanifest',auth=False)
        self.assertEqual(status,200)
        self.assertEqual(json.loads(body)['name'],'NodeRunner')
        self.assertEqual(Path(hns.find_html(None)).name,'NodeRunner.html')
        for script in ['noderunner.py','homenetscanner.py']:
            result = subprocess.run(['python3',str(ROOT/script),'--help'],capture_output=True,text=True,check=True)
            self.assertIn('NodeRunner backend',result.stdout)
            self.assertNotIn('[scan]',result.stdout)

    def test_excel_download_headers_without_scanning_or_saving(self):
        row = [''] * 14
        with mock.patch.object(hns, 'scan') as scan, mock.patch.object(hns, 'save_assignments') as save:
            status, headers, body = self.request('POST', '/api/export.xlsx', json.dumps({'rows': [row]}))
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.assertIn('noderunner-registry-', headers['Content-Disposition'])
        self.assertIn('.xlsx', headers['Content-Disposition'])
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertIsNone(archive.testzip())
        scan.assert_not_called()
        save.assert_not_called()
        self.assertFalse(Path(hns.ASSIGN_FILE).exists())

    def test_excel_invalid_rows_return_400(self):
        for value in [{}, {'rows': None}, {'rows': [[1] * 14]}]:
            self.assertEqual(self.request('POST', '/api/export.xlsx', json.dumps(value))[0], 400)

    def test_bad_body_returns_4xx_and_preserves_data(self):
        hns.save_assignments({'known':{'keep':1}})
        original=Path(hns.ASSIGN_FILE).read_bytes()
        for body in ['-1','{bad','{"config": []}','{"overrides":{"x":{"trusted":"false"}}}',
                     '{"known":{"x":NaN}}', '{"overrides":{"__proto__":{"trusted":true}}}']:
            with self.subTest(body=body):
                self.assertEqual(self.request('POST','/api/assignments',body)[0],400)
                self.assertEqual(Path(hns.ASSIGN_FILE).read_bytes(),original)
        self.assertEqual(self.request('POST','/api/assignments','{}',{'Content-Length':'-1'})[0],400)
        self.assertEqual(self.request('POST','/api/assignments','{}',{'Transfer-Encoding':'chunked'})[0],400)
        self.assertEqual(self.request('POST','/api/assignments','{}',{'Content-Length':str(hns.MAX_BODY_BYTES+1)})[0],413)

    def test_scan_failure_is_json_502(self):
        with mock.patch.object(hns,'scan',side_effect=hns.ScanError('Nmap failed')):
            status,headers,body=self.request('GET','/api/scan')
        self.assertEqual(status,502); self.assertEqual(json.loads(body)['error'],'Nmap failed')
        self.assertEqual(self.state.cache['ts'],123)

    def test_target_survives_registry_save_and_restarts(self):
        status,_,body=self.request('POST','/api/config',json.dumps({'scanTarget':'10.0.0.45/24'}))
        self.assertEqual(status,200); self.assertEqual(self.state.target,'10.0.0.0/24')
        self.assertEqual(self.request('POST','/api/assignments','{"config":{"scanTarget":""},"known":{"x":1}}')[0],200)
        self.assertEqual(hns.load_assignments()['config']['scanTarget'],'10.0.0.0/24')
        self.assertIn('x',hns.load_assignments()['known'])

    def test_invalid_config_does_not_change_state(self):
        for value in [None, 12, '::/0', '--script=evil']:
            self.assertEqual(self.request('POST','/api/config',json.dumps({'scanTarget':value}))[0],400)
        self.assertEqual(self.state.target,'192.168.1.0/24')

    def test_storage_error_does_not_change_target(self):
        with mock.patch.object(hns,'save_assignments',side_effect=OSError('private path')):
            status,_,body=self.request('POST','/api/config','{"scanTarget":"10.0.0.0/24"}')
        self.assertEqual(status,500); self.assertNotIn(b'private path',body)
        self.assertEqual(self.state.target,'192.168.1.0/24')

    def test_corrupt_storage_blocks_reads_and_writes(self):
        Path(hns.ASSIGN_FILE).write_text('{bad')
        self.assertEqual(self.request('GET','/api/assignments')[0],500)
        self.assertEqual(self.request('POST','/api/assignments','{}')[0],500)
        self.assertEqual(Path(hns.ASSIGN_FILE).read_text(),'{bad')

    def test_assets_headers_and_backend_origin_marker(self):
        status,headers,body=self.request('GET','/')
        self.assertEqual(status,200)
        self.assertIn(b'<meta name="noderunner-backend" content="same-origin">',body)
        self.assertIn("script-src 'self'",headers['Content-Security-Policy'])
        self.assertEqual(headers['X-Content-Type-Options'],'nosniff')
        self.assertEqual(self.request('GET','/static/app.js')[0],200)
        for path in ['/noderunner_token.txt','/noderunner.py','/hns_token.txt','/assignments.json','/homenetscanner.py','/static/../hns_token.txt','/static/%2e%2e/hns_token.txt','/static/.hidden']:
            self.assertIn(self.request('GET',path)[0],[403,404])

    def test_branding_allowlist_serves_images_and_rejects_other_files(self):
        for name, content_type, signature in [
            ('icon-96.webp','image/webp',b'RIFF'),
            ('icon-180.png','image/png',b'\x89PNG'),
            ('icon-192.png','image/png',b'\x89PNG'),
            ('icon-512.png','image/png',b'\x89PNG'),
            ('favicon.svg','image/svg+xml',b'<svg'),
            ('favicon-mask.svg','image/svg+xml',b'<svg'),
        ]:
            with self.subTest(name=name):
                status, headers, body = self.request('GET','/static/branding/'+name,auth=False)
                self.assertEqual(status,200)
                self.assertEqual(headers['Content-Type'],content_type)
                self.assertTrue(body.startswith(signature))
        for path in ['/static/branding/private.txt','/static/branding/../../noderunner_token.txt',
                     '/static/branding/%2e%2e/%2e%2e/assignments.json','/assets/branding/originals/icon.jpeg']:
            self.assertIn(self.request('GET',path,auth=False)[0],[403,404])

    def test_branding_directory_symlink_cannot_escape_static_root(self):
        static=self.path/'static';static.mkdir()
        outside=self.path/'outside';outside.mkdir()
        (outside/'icon-96.webp').write_bytes(b'private file')
        (static/'branding').symlink_to(outside,target_is_directory=True)
        with mock.patch.object(hns,'STATIC_DIR',str(static)):
            self.assertEqual(self.request('GET','/static/branding/icon-96.webp',auth=False)[0],403)

    def test_static_symlink_cannot_escape_asset_directory(self):
        static=self.path/'static'; static.mkdir()
        secret=self.path/'secret'; secret.write_text('secret')
        (static/'app.js').symlink_to(secret)
        with mock.patch.object(hns,'STATIC_DIR',str(static)):
            self.assertEqual(self.request('GET','/static/app.js')[0],403)

class ConcurrencyTests(unittest.TestCase):
    def test_parallel_force_requests_share_one_scan(self):
        state=hns.State('192.168.1.0/24',False,30,None)
        started=threading.Event(); release=threading.Event()
        def scan(*args):
            started.set(); release.wait(3); return {'count':0}
        with mock.patch.object(hns,'scan',side_effect=scan) as mocked:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                first=pool.submit(state.get,True); self.assertTrue(started.wait(1))
                second=pool.submit(state.get,True); time.sleep(.05); release.set()
                self.assertEqual(first.result(),second.result())
            self.assertEqual(mocked.call_count,1)

if __name__=='__main__': unittest.main(verbosity=2)
