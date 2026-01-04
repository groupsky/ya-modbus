# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **GitHub Security Advisories** (preferred): https://github.com/groupsky/ya-modbus/security/advisories/new
2. **Email**: security@ya-modbus.dev (if available)

Please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes

### What to expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: Best effort

We will keep you informed of the progress and will credit you in the security advisory (unless you prefer to remain anonymous).

## Security Features

### Docker Images

All published Docker images include:

#### Supply Chain Security

- **SBOM (Software Bill of Materials)**: Complete inventory of all dependencies
- **Build Provenance**: Cryptographically signed attestation of build process
- **Multi-platform Support**: Images built for linux/amd64 and linux/arm64
- **Base Image Tracking**: Automatic updates for Node.js base image vulnerabilities

#### Vulnerability Scanning

- **Automated Scanning**: All images scanned with Trivy on each release
- **Severity Filtering**: CRITICAL and HIGH vulnerabilities reported
- **Security Tab**: Scan results available in repository Security tab
- **Continuous Monitoring**: Dependabot tracks base image updates

#### Runtime Security

- **Non-root User**: Container runs as unprivileged `modbus` user
- **Read-only Config**: Configuration mounted read-only by default
- **Volume Isolation**: Data and config use separate volumes
- **Signal Handling**: Proper shutdown via tini init system

### Verifying Images

Verify Docker image attestations:

```bash
# View SBOM
docker buildx imagetools inspect groupsky/ya-modbus:latest --format "{{ json .SBOM }}"

# View provenance
docker buildx imagetools inspect groupsky/ya-modbus:latest --format "{{ json .Provenance }}"
```

Verify image signatures (when using digest):

```bash
# Pull by digest for immutability
docker pull groupsky/ya-modbus@sha256:<digest>
```

### NPM Packages

- **Provenance**: All packages published with npm provenance
- **Dependency Audits**: Regular `npm audit` in CI
- **Minimal Dependencies**: Only essential runtime dependencies included

## Security Best Practices

### For Users

#### Serial Device Access

When using RTU devices, ensure proper device permissions:

```bash
# Add user to dialout group (Linux)
sudo usermod -aG dialout $USER

# Or use specific device permissions in Docker
docker run --device /dev/ttyUSB0:/dev/ttyUSB0 ...
```

#### MQTT Security

Always use authentication and encryption for MQTT:

```json
{
  "mqtt": {
    "url": "mqtts://broker:8883",
    "username": "user",
    "password": "strong-password",
    "ca": "/path/to/ca.crt"
  }
}
```

#### Environment Variables

Never commit credentials to version control:

```bash
# Use environment variables
docker run -e MQTT_PASSWORD="${MQTT_PASSWORD}" ...

# Or Docker secrets (Swarm)
docker secret create mqtt_password password.txt
```

#### Network Isolation

Run the bridge in isolated networks:

```yaml
# docker-compose.yml
services:
  mqtt-bridge:
    networks:
      - modbus-network
networks:
  modbus-network:
    internal: true
```

## Vulnerability Disclosure Policy

We follow responsible disclosure:

1. **Private Reporting**: Vulnerabilities reported privately first
2. **Fix Development**: We develop and test fixes before public disclosure
3. **Coordinated Disclosure**: Public advisory after fix is released
4. **Credit**: We acknowledge security researchers in advisories

## Security Updates

Subscribe to security advisories:

- **GitHub Watch**: Set repository notifications to "Releases only"
- **Security Advisories**: https://github.com/groupsky/ya-modbus/security/advisories
- **RSS Feed**: https://github.com/groupsky/ya-modbus/releases.atom

## Dependencies

### Automated Updates

- **Dependabot**: Monitors npm and Docker dependencies
- **Weekly Scans**: Dependency updates checked weekly
- **Grouped Updates**: Minor/patch updates batched together
- **Security Updates**: Applied immediately for critical vulnerabilities

### Audit Reports

Run security audit locally:

```bash
# NPM packages
npm audit

# Docker images
docker scan groupsky/ya-modbus:latest
```

## Compliance

### Licenses

- **GPL-3.0-or-later**: Main codebase
- **Third-party**: All dependencies listed in SBOM
- **License Scanning**: Automated in CI

### Privacy

ya-modbus does not:

- Collect telemetry or usage data
- Phone home or send data to external services
- Store credentials in logs

## Contact

For security-related questions or concerns:

- **Security Issues**: Use GitHub Security Advisories
- **General Security Questions**: Open a GitHub Discussion
- **Security Policy Questions**: Create a public issue

## Acknowledgments

We thank the security research community for responsible disclosure and appreciate all contributions to improving ya-modbus security.
