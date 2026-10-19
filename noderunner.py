#!/usr/bin/env python3
"""
NodeRunner - local backend + web server
============================================

Scans your LAN with nmap and serves the results to the NodeRunner web UI.

WHAT IT DOES
  * Auto-detects your local subnet (e.g. 192.168.1.0/24) and default gateway.
  * Runs nmap to discover live hosts -> IP, MAC, vendor, hostname, open ports.
  * Guesses a device type from vendor + open ports (best-effort).
  * Serves:
        GET  /                -> the NodeRunner UI (the standalone .html)
        GET  /api/devices     -> last scan result as JSON (scans once if empty)
        GET  /api/scan        -> forces a fresh scan, returns JSON
  * Adds permissive CORS headers so the UI also works if opened from file://.

REQUIREMENTS
  * Python 3.8+
  * nmap installed and on PATH        (https://nmap.org/download.html)
      - Linux/macOS : run this script with sudo so nmap can read MAC addresses
                      (ARP). Without root you still get IPs, but MAC/vendor may
                      be missing.
      - Windows     : install Nmap + Npcap, run from an Administrator terminal.
  * scapy is NOT required. (It only becomes useful later for fast continuous
    ARP sweeps / passive presence detection.)

USAGE
  sudo python3 noderunner.py
        then open  http://localhost:8000  in your browser.

  Options:
    --port 8000            HTTP port (default 8000)
    --target 192.168.1.0/24   scan this range instead of auto-detected subnet
    --no-ports             skip the port scan (much faster)
    --top-ports 50         how many top ports to probe (default 30)
    --html PATH            HTML file to serve at /  (default: auto-detect
                           NodeRunner.html next to this script)

NOTE: the WiFi vs wired split is NOT derived from the scan (it can't be) - you
set it manually in the UI and it is remembered in your browser.
"""

import argparse
import hmac
import ipaddress
import io
import json
import math
import mimetypes
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import xml.etree.ElementTree as ET
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

# ----------------------------------------------------------------------------
# vendor / port -> device type heuristics
# ----------------------------------------------------------------------------
VENDOR_TYPE = [
    (r"apple", "phone"),
    (r"samsung electro", "phone"),
    (r"google|pixel", "phone"),
    (r"xiaomi|huawei|oneplus|oppo|vivo", "phone"),
    (r"synology|qnap|western digital|seagate", "nas"),
    (r"sony interactive|nintendo|microsoft.*xbox", "console"),
    (r"lg electron|vizio|tcl|hisense|roku|amazon.*fire", "tv"),
    (r"reolink|hikvision|dahua|axis communications|ubiquiti.*cam|wyze", "camera"),
    (r"raspberry", "raspberry"),
    # dedicated single-purpose manufacturers -> safe to type-guess from vendor
    # alone (unlike e.g. "Huawei", which makes everything from phones to
    # inverters and can't be disambiguated from the MAC vendor string).
    (r"daikin|mitsubishi electric|midea|gree electric", "aircon"),
    (r"ariston|vaillant|nibe|stiebel eltron|viessmann", "waterheater"),
    (r"solaredge|fronius|sma solar|growatt|goodwe|sungrow|enphase", "inverter"),
    (r"signify|philips|tp-link.*kasa|tuya|sonoff|espressif|shelly|amazon techn|nest", "iot"),
    (r"intel corporate|micro-star|asustek.*pc|gigabyte|dell|lenovo|hewlett|hp inc", "desktop"),
    (r"brother|canon|epson|hp.*laserjet|xerox", "printer"),
    (r"asustek|tp-link|netgear|d-link|zyxel|fritz|avm|mikrotik|cisco|aruba", "router_like"),
]

PORT_TYPE = [
    ({445, 3389}, "desktop"),
    ({22}, "desktop"),
    ({548, 5001, 5000, 873}, "nas"),
    ({554, 8000, 8554, 37777}, "camera"),
    ({8001, 8008, 8009, 9000}, "tv"),
    ({631, 9100}, "printer"),
]


def guess_type(vendor, ports):
    v = (vendor or "").lower()
    for pat, t in VENDOR_TYPE:
        if re.search(pat, v):
            return "iot" if t == "router_like" else t
    pset = set(ports or [])
    for need, t in PORT_TYPE:
        if pset & need:
            return t
    return "unknown"


# ----------------------------------------------------------------------------
# network helpers
# ----------------------------------------------------------------------------
def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def local_subnet():
    ip = local_ip()
    try:
        net = ipaddress.ip_network(ip + "/24", strict=False)
        return str(net)
    except Exception:
        return "192.168.1.0/24"


def default_gateway():
    """Best-effort default gateway IP, cross-platform."""
    try:
        if sys.platform.startswith("win"):
            out = subprocess.check_output(["route", "print", "0.0.0.0"],
                                          text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                m = re.search(r"0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)", line)
                if m:
                    return m.group(1)
        else:
            # Linux: ip route ; macOS: netstat -rn
            try:
                out = subprocess.check_output(["ip", "route"], text=True,
                                              stderr=subprocess.DEVNULL)
                m = re.search(r"default via (\d+\.\d+\.\d+\.\d+)", out)
                if m:
                    return m.group(1)
            except Exception:
                pass
            out = subprocess.check_output(["netstat", "-rn"], text=True,
                                          stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                parts = line.split()
                if parts and parts[0] in ("default", "0.0.0.0") and len(parts) > 1:
                    if re.match(r"\d+\.\d+\.\d+\.\d+", parts[1]):
                        return parts[1]
    except Exception:
        pass
    # fallback: x.x.x.1
    ip = local_ip().split(".")
    if len(ip) == 4:
        return ".".join(ip[:3] + ["1"])
    return None


def have_nmap():
    try:
        subprocess.check_output(["nmap", "--version"], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def scan_target(value):
    """Only a single IPv4 network may reach nmap, including from the CLI."""
    if not isinstance(value, str):
        raise ValueError("scanTarget must be an IPv4 address or CIDR")
    try:
        network = ipaddress.ip_network(value.strip(), strict=False)
    except ValueError:
        raise ValueError("scanTarget must be an IPv4 address or CIDR") from None
    if network.version != 4:
        raise ValueError("IPv6 scanning is not supported")
    return str(network)


class ScanError(RuntimeError):
    """A failed scan must never be reported as an empty successful scan."""


# ----------------------------------------------------------------------------
# nmap scan
# ----------------------------------------------------------------------------
def nmap_raw_access():
    """Recognize root or Linux CAP_NET_RAW inherited from the system service."""
    if _geteuid_ok():
        return True
    if not sys.platform.startswith("linux"):
        return False
    try:
        with open("/proc/self/status", encoding="ascii", errors="replace") as status:
            for line in status:
                if line.startswith("CapEff:"):
                    # CAP_NET_RAW is bit 13 in the Linux capability ABI.
                    return bool(int(line.split()[1], 16) & (1 << 13))
    except (OSError, ValueError, IndexError):
        pass
    return False


def run_nmap(target, do_ports=True, top_ports=30):
    """Return list of host dicts: ip, mac, vendor, hostname, ports, status."""
    target = scan_target(target)
    # extra retries + longer host-timeout: sleeping WiFi clients (e.g. phones
    # in power-save) often miss the first ARP/ping probe and need a retry
    # window wide enough to catch their DTIM wake-up before being marked down.
    args = ["nmap", "-oX", "-", "--host-timeout", "45s", "--max-retries", "6"]
    raw_access = nmap_raw_access()
    if raw_access and not _geteuid_ok():
        # Nmap 7.92 otherwise checks only UID, ignoring inherited capabilities.
        args.append("--privileged")
    if do_ports:
        # Raw scans also perform ARP discovery on directly connected Ethernet.
        args += ["-sS" if raw_access else "-sT", "--top-ports", str(top_ports), "-T4"]
    else:
        args += ["-sn"]   # ping/ARP discovery only
    args.append(target)

    try:
        xml = subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL,
                                      timeout=600)
    except subprocess.TimeoutExpired:
        raise ScanError("Nmap scan timed out; retry or select a smaller network") from None
    except (subprocess.CalledProcessError, OSError):
        raise ScanError("Nmap failed; check installation, privileges and scan target") from None

    hosts = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        raise ScanError("Nmap returned invalid scan data") from None
    if root.tag != "nmaprun":
        raise ScanError("Nmap returned invalid scan data")
    finished = root.find("runstats/finished")
    if finished is not None and finished.get("exit") == "error":
        raise ScanError("Nmap could not complete the scan")

    for h in root.findall("host"):
        st = h.find("status")
        if st is not None and st.get("state") != "up":
            continue
        ip = mac = vendor = hostname = None
        for addr in h.findall("address"):
            kind = addr.get("addrtype")
            if kind == "ipv4":
                ip = addr.get("addr")
            elif kind == "mac":
                mac = addr.get("addr")
                vendor = addr.get("vendor")
        hn = h.find("hostnames/hostname")
        if hn is not None:
            hostname = hn.get("name")
        ports = []
        for p in h.findall("ports/port"):
            stt = p.find("state")
            if stt is not None and stt.get("state") == "open":
                try:
                    ports.append(int(p.get("portid")))
                except (TypeError, ValueError):
                    pass
        if not ip:
            continue
        hosts.append({
            "ip": ip,
            "mac": (mac or "").upper() or None,
            "vendor": vendor,
            "hostname": hostname,
            "ports": sorted(ports),
            "status": "online",
        })
    return hosts


# small shim so the script runs on Windows (no os.geteuid)
def _geteuid_ok():
    try:
        return os.geteuid() == 0
    except AttributeError:
        return True  # assume privileged on Windows (user told to run as admin)


def scan(target, do_ports=True, top_ports=30):
    target = scan_target(target)
    gw_ip = default_gateway()
    hosts = run_nmap(target, do_ports=do_ports, top_ports=top_ports)
    gateway = None
    devices = []
    for h in hosts:
        h["type"] = guess_type(h.get("vendor"), h.get("ports"))
        if gw_ip and h["ip"] == gw_ip:
            gateway = {
                "ip": h["ip"], "mac": h.get("mac"),
                "vendor": h.get("vendor") or "Router",
                "hostname": h.get("hostname") or "Gateway Router",
                "ports": h.get("ports", []),
                "status": "online",
            }
        else:
            devices.append(h)
    if gateway is None and gw_ip and ipaddress.ip_address(gw_ip) in ipaddress.ip_network(target):
        gateway = {"ip": gw_ip, "mac": None, "vendor": "Router",
                   "hostname": "Gateway Router", "ports": [], "status": "unknown"}
    return {
        "ts": int(time.time()),
        "subnet": target,
        "gateway": gateway,
        "devices": devices,
        "count": len(devices),
        "portsScanned": do_ports,
    }


# ----------------------------------------------------------------------------
# assignments persistence (selected data directory; default: next to script)
# ----------------------------------------------------------------------------
# Holds the user's manual data so it survives restarts and is shared across
# browsers/devices: { "overrides": {id: {...}}, "known": {id: ts}, "baseline": bool,
# "config": {"customTypes": {key: {label, icon}}, "customVendors": [name, ...]} }
# "config" is GLOBAL app settings (custom device-type icons, custom vendor
# list) - not tied to any single host, unlike "overrides".
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = PROJECT_DIR
ASSIGN_FILE = os.path.join(PROJECT_DIR, "assignments.json")
# Static assets live under ASSETS_DIR/static, independently of --html.
# configure_paths() selects system paths or the source-tree defaults.
STATIC_DIR = os.path.join(ASSETS_DIR, "static")
assign_lock = threading.RLock()
MAX_BODY_BYTES = 2 * 1024 * 1024
RESERVED_KEYS = {"__proto__", "prototype", "constructor"}

# ----------------------------------------------------------------------------
# API access token - required (header "X-NodeRunner-Token") on every /api/* request.
# Generated once and persisted in the selected data directory across restarts;
# the same value has to be pasted into Settings -> Connection in the UI, once
# per browser/device. This is what stops a random webpage from silently
# driving /api/scan or /api/assignments via a forged cross-origin request
# (the wildcard CORS header below is needed for the "point the UI at a remote
# backend" use case and does NOT by itself stop a request from being sent -
# it only affects whether JS can read the response - so the token is the
# actual access control, not the CORS header).
# ----------------------------------------------------------------------------
def token_file(directory):
    """Keep an installed secret in place; new installations use the new name."""
    current = os.path.join(directory, "noderunner_token.txt")
    legacy = os.path.join(directory, "hns_token.txt")
    if os.path.lexists(current):
        return current
    return legacy if os.path.lexists(legacy) else current


TOKEN_FILE = token_file(os.path.dirname(os.path.abspath(__file__)))


def configure_paths(data_dir=None, assets_dir=None):
    """Separate mutable state from packaged assets; keep source-tree defaults."""
    global ASSIGN_FILE, TOKEN_FILE, ASSETS_DIR, STATIC_DIR
    data_dir = os.path.abspath(data_dir or PROJECT_DIR)
    assets_dir = os.path.abspath(assets_dir or PROJECT_DIR)
    if not os.path.isdir(os.path.join(assets_dir, "static")):
        raise ValueError("assets directory must contain static/")
    # Do not migrate or reset an existing registry when changing directories.
    os.makedirs(data_dir, mode=0o700, exist_ok=True)
    ASSIGN_FILE = os.path.join(data_dir, "assignments.json")
    TOKEN_FILE = token_file(data_dir)
    ASSETS_DIR = assets_dir
    STATIC_DIR = os.path.join(assets_dir, "static")


def load_or_create_token():
    try:
        fd = os.open(TOKEN_FILE, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    except FileNotFoundError:
        tok = secrets.token_hex(16)
        # Exclusive creation gives private permissions before any secret is written.
        fd = os.open(TOKEN_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(tok)
        return tok
    with os.fdopen(fd, "r") as f:
        if hasattr(os, "fchmod"):
            os.fchmod(f.fileno(), 0o600)
        tok = f.read(257).strip()
    if not re.fullmatch(r"[a-zA-Z0-9_-]{32,256}", tok):
        raise ValueError("Invalid API token file; restore it before starting the server")
    return tok


def load_assignments():
    try:
        with open(ASSIGN_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {}
    # A corrupt/unreadable file is an error, never an empty registry to overwrite.
    return validate_assignments(data)


def object_map(value, name, limit=10000):
    if not isinstance(value, dict) or len(value) > limit:
        raise ValueError("%s must be an object with at most %d entries" % (name, limit))
    if any(not isinstance(k, str) or not k or len(k) > 128 or k in RESERVED_KEYS for k in value):
        raise ValueError("%s contains an invalid key" % name)
    return value


def text_value(value, name, limit=1024):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError("%s must be a string of at most %d characters" % (name, limit))
    return value


def timestamp_value(value, name):
    if type(value) not in (int, float) or not 0 <= value <= 9007199254740991 or not math.isfinite(value):
        raise ValueError("%s must be a finite non-negative number" % name)
    return value


def validate_assignments(data):
    """Validate all input paths: disk, imports sent by the browser, and API calls."""
    object_map(data, "assignments")
    overrides = object_map(data.get("overrides", {}), "overrides")
    known = object_map(data.get("known", {}), "known")
    config = object_map(data.get("config", {}), "config", 20)
    baseline = data.get("baseline", False)
    if not isinstance(baseline, bool):
        raise ValueError("baseline must be a boolean")
    clean = {}
    strings = {"alias", "name", "typeOverride", "vendorOverride", "room",
               "lastIp", "lastMac", "lastHostname", "vendorAuto", "typeAuto"}
    for key, entry in overrides.items():
        object_map(entry, "device override", 30)
        out = {}
        for field in strings & entry.keys():
            out[field] = text_value(entry[field], field)
        for field in ("trusted", "flagged", "blocked"):
            if field in entry:
                if not isinstance(entry[field], bool):
                    raise ValueError("%s must be a boolean" % field)
                out[field] = entry[field]
        if "conn" in entry:
            if entry["conn"] not in ("wifi", "wired", "unset"):
                raise ValueError("Invalid connection type")
            out["conn"] = entry["conn"]
        if "lastSeen" in entry:
            out["lastSeen"] = timestamp_value(entry["lastSeen"], "lastSeen")
        if "lastPorts" in entry:
            ports = entry["lastPorts"]
            if not isinstance(ports, list) or len(ports) > 65535 or any(type(p) is not int or not 1 <= p <= 65535 for p in ports):
                raise ValueError("lastPorts must be a list of TCP port numbers")
            out["lastPorts"] = ports
        if "pos" in entry and entry["pos"] is not None:
            pos = object_map(entry["pos"], "pos", 2)
            if set(pos) != {"xPct", "yPct"} or any(type(v) not in (int, float) or not 0 <= v <= 100 or not math.isfinite(v) for v in pos.values()):
                raise ValueError("Position coordinates must be between 0 and 100")
            out["pos"] = pos
        clean[key] = out
    for value in known.values():
        timestamp_value(value, "known timestamp")
    custom_types = object_map(config.get("customTypes", {}), "customTypes", 500)
    for entry in custom_types.values():
        object_map(entry, "custom type", 2)
        text_value(entry.get("label", ""), "type label", 120)
        text_value(entry.get("icon", ""), "type icon", 20000)
    vendors = config.get("customVendors", [])
    if not isinstance(vendors, list) or len(vendors) > 500:
        raise ValueError("customVendors must be a list with at most 500 entries")
    for vendor in vendors:
        text_value(vendor, "vendor", 120)
    cfg = {"customTypes": sanitize_custom_types(custom_types), "customVendors": vendors,
           "scanTarget": config.get("scanTarget", "")}
    if cfg["scanTarget"]:
        cfg["scanTarget"] = scan_target(cfg["scanTarget"])
    elif not isinstance(cfg["scanTarget"], str):
        raise ValueError("scanTarget must be a string")
    # Missing rooms means defaults; an explicit empty object means none.
    if "rooms" in config:
        rooms = object_map(config["rooms"], "rooms", 100)
        cfg["rooms"] = {}
        for key, room in rooms.items():
            object_map(room, "room", 20)  # tolerate legacy layout metadata
            cfg["rooms"][key] = {"label": text_value(room.get("label", ""), "room label", 120)}
            if "gridSize" in room:
                side = room["gridSize"]
                if type(side) is not int or side not in (2, 3, 4):
                    raise ValueError("room gridSize must be 2, 3 or 4")
                cfg["rooms"][key]["gridSize"] = side
    return {"overrides": clean, "known": known, "baseline": baseline, "config": cfg}


SVG_ICON_ALLOWED_TAGS = {"path", "circle", "rect", "line", "ellipse", "polygon", "polyline", "g"}
SVG_ICON_ALLOWED_ATTRS = {
    "d", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "points",
    "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
    "stroke-miterlimit", "transform", "opacity", "fill-rule", "clip-rule",
}


def sanitize_icon_svg(markup):
    """Whitelist-sanitize a custom device-type icon (raw SVG markup pasted by
    whoever holds the API token, see Settings -> Custom device types ->
    advanced field). This is stored in config.customTypes and synced to every
    browser/device connected to this backend, then dropped into innerHTML by
    iconFor() client-side - so an unsanitized <image onerror=...> saved here
    would run in every OTHER viewer's session. The frontend has its own copy
    of this whitelist (sanitizeIconSvg in icons.js) but this is the
    authoritative one: it also has to cover POST /api/assignments called
    directly (curl + token), which never goes through the UI at all.
    Anything that doesn't parse as a plain shape snippet is dropped entirely
    rather than guessed at."""
    if not isinstance(markup, str):
        return ""
    markup = markup.strip()
    # DOCTYPE/ENTITY/processing-instructions are never needed for a shape
    # snippet and are how XML parsers get abused (entity-expansion DoS,
    # external entity/stylesheet loads) - reject before ever handing this to
    # ElementTree rather than trying to parse them safely.
    if not markup or len(markup) > 20000 or "<!" in markup or "<?" in markup:
        return ""
    try:
        root = ET.fromstring("<svg>" + markup + "</svg>")
    except ET.ParseError:
        return ""

    def clean(el, depth=0):
        if depth > 32:
            return []
        out = []
        for child in el:
            tag = child.tag.split("}")[-1].lower()
            if tag not in SVG_ICON_ALLOWED_TAGS:
                continue
            new = ET.Element(tag)
            for k, v in child.attrib.items():
                name = k.split("}")[-1].lower()
                if name in SVG_ICON_ALLOWED_ATTRS and not re.search(r"url\s*\(|[\\\x00-\x1f]", v, re.I):
                    new.set(name, v)
            new.extend(clean(child, depth + 1))
            out.append(new)
        return out

    frag = ET.Element("g")
    frag.extend(clean(root))
    return "".join(ET.tostring(c, encoding="unicode") for c in frag)


def sanitize_custom_types(custom_types):
    if not isinstance(custom_types, dict):
        return {}
    out = {}
    for key, val in custom_types.items():
        if not isinstance(key, str) or not isinstance(val, dict):
            continue
        label = val.get("label", "")
        out[key] = {
            "label": str(label)[:60] if isinstance(label, str) else "",
            "icon": sanitize_icon_svg(val.get("icon", "")),
        }
    return out


def save_assignments(data):
    with assign_lock:
        data = validate_assignments(data)
        fd, tmp = tempfile.mkstemp(prefix=".noderunner-", suffix=".tmp", dir=os.path.dirname(ASSIGN_FILE))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, allow_nan=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, ASSIGN_FILE)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)


def backup_assignments():
    """Keep the last 5 daily backups of assignments.json next to the main file."""
    if not os.path.isfile(ASSIGN_FILE):
        return
    today = time.strftime("%Y-%m-%d")
    bak = ASSIGN_FILE + ".bak." + today
    if not os.path.isfile(bak):
        # Never follow a pre-created backup symlink when running as root.
        try:
            fd = os.open(bak, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            return
        with os.fdopen(fd, "wb") as dst, open(ASSIGN_FILE, "rb") as src:
            import shutil
            shutil.copyfileobj(src, dst)
        # prune: keep only the 5 most recent backups
        import glob
        baks = sorted(glob.glob(ASSIGN_FILE + ".bak.*"))
        for old in baks[:-5]:
            try:
                os.remove(old)
            except OSError:
                pass


# ----------------------------------------------------------------------------
# HTTP server
# ----------------------------------------------------------------------------
class State:
    def __init__(self, target, do_ports, top_ports, html_path):
        self.target = scan_target(target)
        self.do_ports = do_ports
        self.top_ports = top_ports
        self.html_path = html_path
        self.cache = None
        self.lock = threading.Lock()
        self.revision = 0

    def set_target(self, new_target):
        with self.lock:
            self.target = scan_target(new_target)
            self.cache = None  # force fresh scan on next request

    def get(self, force=False):
        revision = self.revision
        with self.lock:
            # Requests arriving during the same scan share its result instead
            # of queuing a separate nmap process for each connected browser.
            if self.cache is None or (force and revision == self.revision):
                print("[scan] %s (ports=%s) ..." % (self.target, self.do_ports))
                self.cache = scan(self.target, self.do_ports, self.top_ports)
                self.revision += 1
                print("[scan] done - %d hosts" % self.cache["count"])
            return self.cache


REGISTRY_EXPORT_COLUMNS = [
    "Trusted", "Scan status", "Alias", "Hostname", "IP address", "MAC address",
    "Vendor", "Type", "Room", "Connection", "Ports", "Last seen (UTC)", "Flagged", "Marked blocked",
]


def registry_xlsx(rows):
    """Create a small OOXML workbook using only the standard library.

    Every cell is an inline string, including values starting with =, +, -
    or @. Device-controlled names must never become formulas or hyperlinks.
    """
    if not isinstance(rows, list) or len(rows) > 10000:
        raise ValueError("Export must contain at most 10000 device rows")
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    sheet = ET.Element("worksheet", {"xmlns": ns})
    ET.SubElement(sheet, "dimension", ref="A1:N%d" % (len(rows) + 1))
    views = ET.SubElement(sheet, "sheetViews")
    view = ET.SubElement(views, "sheetView", workbookViewId="0")
    ET.SubElement(view, "pane", ySplit="1", topLeftCell="A2", activePane="bottomLeft", state="frozen")
    ET.SubElement(sheet, "sheetFormatPr", defaultRowHeight="20")
    columns = ET.SubElement(sheet, "cols")
    for index, width in enumerate([12, 20, 22, 26, 18, 22, 24, 25, 18, 14, 28, 26, 12, 18], 1):
        ET.SubElement(columns, "col", min=str(index), max=str(index), width=str(width), customWidth="1")
    data = ET.SubElement(sheet, "sheetData")
    for row_index, values in enumerate([REGISTRY_EXPORT_COLUMNS] + rows, 1):
        if not isinstance(values, list) or len(values) != len(REGISTRY_EXPORT_COLUMNS):
            raise ValueError("Each export row must contain 14 text cells")
        row = ET.SubElement(data, "row", r=str(row_index))
        if row_index == 1:
            row.set("ht", "26")
            row.set("customHeight", "1")
        for col_index, value in enumerate(values):
            value = text_value(value, "export cell", 32767)
            value = re.sub(r"[^\x09\x0a\x0d\x20-\ud7ff\ue000-\ufffd\U00010000-\U0010ffff]", "", value)
            if len(value.encode("utf-16-le")) // 2 > 32767:
                raise ValueError("An export cell is too long for Excel")
            # Preserve literal Excel escape sequences instead of decoding them.
            value = re.sub(r"_x[0-9a-fA-F]{4}_", lambda match: "_x005F_" + match.group()[1:], value)
            cell = ET.SubElement(row, "c", r=chr(65 + col_index) + str(row_index), t="inlineStr", s="1" if row_index == 1 else "0")
            inline = ET.SubElement(cell, "is")
            ET.SubElement(inline, "t", {"xml:space": "preserve"}).text = value
    ET.SubElement(sheet, "autoFilter", ref="A1:N%d" % (len(rows) + 1))
    parts = {
        "[Content_Types].xml": '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>''',
        "_rels/.rels": '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''',
        "xl/workbook.xml": '''<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews><sheets><sheet name="Host registry" sheetId="1" r:id="rId1"/></sheets></workbook>''',
        "xl/_rels/workbook.xml.rels": '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>''',
        "xl/styles.xml": '''<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>''',
        "xl/worksheets/sheet1.xml": ET.tostring(sheet, encoding="utf-8", xml_declaration=True),
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in parts.items():
            archive.writestr(path, content)
    return output.getvalue()


class RequestError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class ScannerHTTPServer(ThreadingHTTPServer):
    """Bound threads as well as request sizes on a LAN-facing service."""
    daemon_threads = True

    def __init__(self, *args, **kwargs):
        self.slots = threading.BoundedSemaphore(32)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


def make_handler(state, token):
    class H(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, *a):
            pass

        def _cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")

        def _csp(self):
            # Second layer of defense behind sanitize_icon_svg()/escapeHtml():
            # no script-src 'unsafe-inline' means an injected onerror=/onload=
            # handler (or a <script> tag) that somehow slipped through the
            # sanitizer still can't execute. Matches what NodeRunner.html
            # actually loads (self-hosted JS, Google Fonts, backend fetches on
            # :8000) - a custom --html page with different needs may require
            # adjusting this.
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src https://fonts.gstatic.com; img-src 'self' data:; "
                "connect-src 'self' http://*:8000 https://*:8000; "
                "object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
            )

        def _authorized(self):
            got = self.headers.get("X-NodeRunner-Token")
            if got is None:  # Existing API clients remain supported.
                got = self.headers.get("X-HNS-Token", "")
            return hmac.compare_digest(got.encode("utf-8"), token.encode("utf-8"))

        def _read_json(self):
            if self.headers.get("Transfer-Encoding"):
                raise RequestError("Transfer-Encoding is not supported")
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1:
                raise RequestError("Exactly one Content-Length is required", 411)
            if not re.fullmatch(r"[0-9]+", lengths[0]):
                raise RequestError("Invalid Content-Length")
            if len(lengths[0]) > 10:
                raise RequestError("Request body is too large", 413)
            length = int(lengths[0])
            if length > MAX_BODY_BYTES:
                raise RequestError("Request body is too large", 413)
            try:
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise RequestError("Incomplete request body")
                def invalid_constant(value):
                    raise ValueError("Invalid JSON constant")
                data = json.loads(raw.decode("utf-8"), parse_constant=invalid_constant)
            except socket.timeout:
                raise RequestError("Request body timed out", 408) from None
            except (ValueError, UnicodeError, RecursionError):
                raise RequestError("Invalid JSON body") from None
            if not isinstance(data, dict):
                raise RequestError("JSON body must be an object")
            return data

        def _json(self, obj, code=200):
            body = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-NodeRunner-Token, X-HNS-Token")
            self.end_headers()

        def do_GET(self):
            try:
                self._get()
            except ScanError as exc:
                self._json({"ok": False, "error": str(exc)}, 502)
            except (OSError, ValueError, RecursionError):
                self._json({"ok": False, "error": "Cannot read application data; check files and permissions"}, 500)

        def _get(self):
            path = unquote(self.path.split("?")[0])
            if path.startswith("/api/"):
                if not self._authorized():
                    self._json({"ok": False, "error": "missing or invalid token"}, 403)
                    return
                if path == "/api/devices":
                    self._json(state.get(force=False))
                elif path == "/api/scan":
                    self._json(state.get(force=True))
                elif path == "/api/assignments":
                    self._json(load_assignments())
                elif path == "/api/config":
                    self._json({"scanTarget": state.target})
                else:
                    self.send_response(404)
                    self._cors()
                    self.end_headers()
            elif path.startswith("/static/"):
                self._serve_static(path[len("/static/"):])
            elif path in ("/", "/index.html", "/NodeRunner.html", "/HomeNetScanner.html"):
                self._serve_html()
            else:
                self.send_response(404)
                self._cors()
                self.end_headers()

        def do_POST(self):
            try:
                self._post()
            except RequestError as exc:
                self._json({"ok": False, "error": str(exc)}, exc.status)
            except (OSError, ValueError, RecursionError):
                self._json({"ok": False, "error": "Cannot save application data; check files and permissions"}, 500)

        def _post(self):
            path = self.path.split("?")[0]
            if path.startswith("/api/") and not self._authorized():
                self._json({"ok": False, "error": "missing or invalid token"}, 403)
                return
            if path == "/api/export.xlsx":
                data = self._read_json()
                try:
                    body = registry_xlsx(data.get("rows"))
                except ValueError as exc:
                    raise RequestError(str(exc)) from None
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                self.send_header("Content-Disposition", 'attachment; filename="noderunner-registry-%s.xlsx"' % time.strftime("%Y-%m-%d"))
                self._cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif path == "/api/assignments":
                data = self._read_json()
                # Registry saves must not reset the independently configured scan target.
                try:
                    data = validate_assignments(data)
                except ValueError as exc:
                    raise RequestError(str(exc)) from None
                with assign_lock:
                    previous = load_assignments()  # fail closed if the registry is corrupt
                    data["config"]["scanTarget"] = previous["config"]["scanTarget"]
                    save_assignments(data)
                self._json({"ok": True})
            elif path == "/api/config":
                data = self._read_json()
                if "scanTarget" not in data:
                    raise RequestError("missing scanTarget")
                try:
                    new_target = scan_target(data["scanTarget"])
                except ValueError as exc:
                    raise RequestError(str(exc)) from None
                # Lock order is always state -> assignments; persist before changing memory.
                with state.lock:
                    with assign_lock:
                        ass = load_assignments()
                        ass["config"]["scanTarget"] = new_target
                        save_assignments(ass)
                    state.target = new_target
                    state.cache = None
                self._json({"ok": True, "scanTarget": new_target})
            else:
                self.send_response(404)
                self._cors()
                self.end_headers()

        def _serve_static(self, rel_path):
            # block path traversal (../, absolute paths) before touching disk
            safe = os.path.normpath(rel_path)
            fp = os.path.realpath(os.path.join(STATIC_DIR, safe))
            root = os.path.realpath(STATIC_DIR)
            allowed = {"app.js", "data.js", "icons.js", "registry.js", "settings.js", "style.css",
                       "noderunner.svg", "noderunner-mask.svg", "manifest.webmanifest",
                       "branding/icon-96.webp", "branding/icon-180.png",
                       "branding/icon-192.png", "branding/icon-512.png",
                       "branding/favicon.svg", "branding/favicon-mask.svg"}
            if safe.replace(os.sep, "/") not in allowed or os.path.commonpath([root, fp]) != root:
                self.send_response(403)
                self._cors()
                self.end_headers()
                return
            if not os.path.isfile(fp):
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
            with open(fp, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _serve_html(self):
            p = state.html_path
            if p and os.path.isfile(p):
                with open(p, "rb") as f:
                    body = f.read()
                body = body.replace(b"<head>", b'<head>\n<meta name="noderunner-backend" content="same-origin">', 1)
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._cors()
                self._csp()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                msg = (b"<h1>NodeRunner backend running</h1>"
                       b"<p>API: <a href='/api/devices'>/api/devices</a></p>"
                       b"<p>UI file not found. Pass --html PATH or place "
                       b"NodeRunner.html next to the script.</p>")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._cors()
                self._csp()
                self.end_headers()
                self.wfile.write(msg)
    return H


def find_html(explicit):
    if explicit:
        return os.path.abspath(explicit)
    here = ASSETS_DIR
    for name in ("NodeRunner.html", "HomeNetScanner.html", "HomeNetScanner-standalone.html"):
        cand = os.path.join(here, name)
        if os.path.isfile(cand):
            return cand
    return None


def main():
    ap = argparse.ArgumentParser(description="NodeRunner backend + server")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--bind", default="0.0.0.0", help="IPv4 listen address (default: all interfaces)")
    ap.add_argument("--target", default=None, help="CIDR to scan (default: auto)")
    ap.add_argument("--no-ports", action="store_true", help="skip port scan")
    ap.add_argument("--top-ports", type=int, default=30)
    ap.add_argument("--html", default=None, help="HTML file to serve at /")
    ap.add_argument("--data-dir", default=os.environ.get("NODERUNNER_DATA_DIR"),
                    help="registry, token and backup directory (default: next to script)")
    ap.add_argument("--assets-dir", default=os.environ.get("NODERUNNER_ASSETS_DIR"),
                    help="directory containing NodeRunner.html and static/")
    args = ap.parse_args()
    if not 1 <= args.port <= 65535:
        ap.error("--port must be between 1 and 65535")
    try:
        args.bind = str(ipaddress.IPv4Address(args.bind))
    except ipaddress.AddressValueError:
        ap.error("--bind must be an IPv4 address")
    if not 1 <= args.top_ports <= 65535:
        ap.error("--top-ports must be between 1 and 65535")
    if args.target is not None:
        try:
            args.target = scan_target(args.target)
        except ValueError as exc:
            ap.error(str(exc))

    try:
        configure_paths(args.data_dir, args.assets_dir)
    except (ValueError, OSError) as exc:
        ap.error("cannot configure installation paths: %s" % exc)

    backup_assignments()   # daily backup on every startup

    if not have_nmap():
        print("ERROR: nmap not found on PATH. Install it from https://nmap.org/")
        sys.exit(1)

    target = args.target or local_subnet()
    if not args.target:
        _ass = load_assignments()
        _saved = (_ass.get("config") or {}).get("scanTarget", "")
        if _saved:
            try:
                target = scan_target(_saved)
                print("[config] restored saved scan target: %s" % target)
            except ValueError:
                pass
    html = find_html(args.html)

    if not nmap_raw_access():
        print("WARNING: raw-network privileges are unavailable; MAC addresses "
              "and vendors may be missing. Use the packaged service with "
              "CAP_NET_RAW for local-network discovery.\n")

    state = State(target, not args.no_ports, args.top_ports, html)
    token = load_or_create_token()

    # warm up the cache in the background so the first page load is instant-ish
    def warm_cache():
        try:
            state.get(force=True)
        except ScanError as exc:
            print("[scan] %s" % exc)
    threading.Thread(target=warm_cache, daemon=True).start()

    httpd = ScannerHTTPServer((args.bind, args.port), make_handler(state, token))
    print("NodeRunner backend")
    print("  subnet : %s" % target)
    print("  ui     : %s" % (html or "(none - API only)"))
    print("  serving: http://localhost:%d" % args.port)
    print("  api    : http://localhost:%d/api/devices" % args.port)
    print("  token  : %s" % token)
    print("           paste this into the web UI's Settings -> Connection panel,")
    print("           once per browser/device (kept in %s)" % TOKEN_FILE)
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
