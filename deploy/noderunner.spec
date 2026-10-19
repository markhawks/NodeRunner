Name:           noderunner
Version:        0.1.3
Release:        0.1.test%{?dist}
Summary:        Local network scanner and room mapper
License:        AGPL-3.0-only
URL:            https://github.com/markhawks/NodeRunner
Source0:        %{url}/releases/download/v%{version}/%{name}-%{version}.tar.gz
BuildArch:      noarch
BuildRequires:  python3
BuildRequires:  /usr/bin/node
BuildRequires:  systemd-rpm-macros
Requires:       python3
Requires:       nmap
%{?systemd_requires}

%description
Discover LAN devices with Nmap, arrange them on room maps, maintain a device
registry and export reports through a browser. Experimental Fedora 44 package.
The optional system service uses a dedicated non-root account with limited
raw-network capability and binds to the local host.
Installing this package does not start a network scan.

%prep
%autosetup

%build
# Plain Python and browser JavaScript: no compilation or downloaded dependencies.

%install
install -d %{buildroot}%{_datadir}/%{name}/static
install -m 0644 NodeRunner.html %{buildroot}%{_datadir}/%{name}/
# The private Python file is invoked explicitly by the launcher, not executed.
sed '1{/^#!/d;}' noderunner.py > %{buildroot}%{_datadir}/%{name}/noderunner.py
chmod 0644 %{buildroot}%{_datadir}/%{name}/noderunner.py
cp -a static/. %{buildroot}%{_datadir}/%{name}/static/
install -Dpm 0755 deploy/noderunner %{buildroot}%{_bindir}/noderunner
install -Dpm 0644 deploy/noderunner.service %{buildroot}%{_unitdir}/noderunner.service
install -Dpm 0644 deploy/noderunner.sysusers %{buildroot}%{_sysusersdir}/noderunner.conf
install -Dpm 0644 deploy/noderunner.conf %{buildroot}%{_sysconfdir}/noderunner/noderunner.conf
install -d -m 0700 %{buildroot}%{_localstatedir}/lib/noderunner
install -Dpm 0644 deploy/noderunner.1 %{buildroot}%{_mandir}/man1/noderunner.1

%check
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/test_frontend.js
python3 noderunner.py --help
sh -n deploy/noderunner

%post
%systemd_post noderunner.service

%preun
%systemd_preun noderunner.service

%files
%license LICENSE
%doc README.md README.it.md CHANGELOG.md deploy/INSTALL.md
%{_bindir}/noderunner
%{_mandir}/man1/noderunner.1*
%{_datadir}/%{name}/
%{_unitdir}/noderunner.service
%{_sysusersdir}/noderunner.conf
%dir %{_sysconfdir}/noderunner
%config(noreplace) %{_sysconfdir}/noderunner/noderunner.conf
%dir %attr(0700,noderunner,noderunner) %{_localstatedir}/lib/noderunner

%changelog
* Mon Oct 19 2026 NodeRunner contributors - 0.1.3-0.1.test
- Enable local MAC discovery with service-scoped CAP_NET_RAW and AF_PACKET.

* Sat Oct 17 2026 NodeRunner contributors - 0.1.2-0.1.test
- Initial experimental Fedora 44 RPM; service is not started on installation.
