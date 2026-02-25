# OS Configuration Overlays

This directory contains system configuration files that are deployed during installation.

## Structure

```
packages/os/
├── overlay-common/          # Files applied to all systems
│   └── etc/
│       ├── netplan/
│       │   └── 01-netcfg.yaml
│       ├── NetworkManager/
│       │   └── NetworkManager.conf
│       └── systemd/
│           └── logind.conf.d/
│               ├── lid-switch.conf
│               └── power-button.conf
└── overlay-server/          # Server-specific overrides (future)
```

## Files

### 01-netcfg.yaml
- **Purpose**: Configure netplan to use NetworkManager as the network renderer
- **Key settings**:
  - `renderer: NetworkManager`: Use NetworkManager instead of systemd-networkd
- **Why needed**: Ubuntu Server defaults to systemd-networkd, which prevents NetworkManager from managing WiFi

### NetworkManager.conf
- **Purpose**: Configure NetworkManager to manage all network interfaces
- **Key settings**:
  - `managed=true`: Enable NetworkManager to manage interfaces
  - `wifi.scan-rand-mac-address=no`: Disable MAC randomization for stability

### lid-switch.conf
- **Purpose**: Prevent laptop from sleeping when lid is closed
- **Use case**: Running home-server on a laptop as a headless server

### power-button.conf
- **Purpose**: Prevent accidental shutdown when power button is pressed
- **Use case**: Avoid accidental shutdowns on devices used as servers

## Usage

These files are automatically deployed by `scripts/install.sh` during installation:

```bash
# Copy overlay files to system
rsync -a packages/os/overlay-common/ /
```

## Adding New Configs

1. Add file to `overlay-common/` maintaining the system path structure
2. Update `scripts/install.sh` to reload affected services
3. Document the file in this README
