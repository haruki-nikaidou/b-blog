---
title: 'Install NVIDIA driver in an ESXi VM'
description: 'Tried to install nvidia driver in an EXSi VM, but cannot find the GPU in nvidia-smi. The issue is solved with solution in the nvidia forum.'
pubDate: 'Nov 28 2023'
updatedDate: 'Nov 8 2024'
pinned: true
heroImage: 'https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/1ccd914c-455c-4eee-8bde-b28aae802100/small'
---

Recently, I wanted to set up a server for AI in my homelab. For I only have one motherboard that have enough space for a RTX 3090,
and it is too expensive to buy a new set up, I decided to install EXSi on that server and use GPU passthrough.

The VM is configured on:

+ EPYC 7302 * 48
+ Based on ESXi-7.0u3
+ NVIDIA GeForce RTX 3090
+ 128GB memory
+ Debian GNU/Linux 12 (bookworm) x86_64

> edited at Nov 8 2024: I don't know why I use so much memory and cpu cores, 
> actually that doesn't matter at all, AI models don't use CPU and memory.

## Progress

Firstly, create the VM in ESXi and enable the ability of passthrough NVIDIA GPU:

+ pre-alloc all memory
+ set `hypervisor.cpuid.v0=FALSE` in VM config file
+ set `pciPassthru0.msiEnabled=FALSE` in VM config file

If you create the VM without any extra config, GPU will not work. 
But anyway, you can find these operation in many otherwhere.
Without any further ado, here is the installation progress:

Config apt to include `non-free-firmware`. In `/etc/apt/source.list`, add `non-free-firmware`, like

```
deb https://deb.debian.org/debian/ bookworm main contrib non-free non-free-firmware
```

Then, update apt source.

```bash
sudo apt update
apt search ^nvidia-driver
```

If you nothing goes wrong, should be able to find the nvidia driver package like

```
nvidia-driver/unknown 545.23.06-1 amd64
  NVIDIA metapackage
```

## Issue

In normal physical machine, just run `sudo apt install nvidia-driver` is enough. But in VM, that doesn't work.

After installed cuda with 

```bash
sudo apt-get install software-properties-common
wget https://developer.download.nvidia.com/compute/cuda/12.3.0/local_installers/cuda-repo-debian12-12-3-local_12.3.0-545.23.06-1_amd64.deb
sudo dpkg -i cuda-repo-debian12-12-3-local_12.3.0-545.23.06-1_amd64.deb
sudo cp /var/cuda-repo-debian12-12-3-local/cuda-*-keyring.gpg /usr/share/keyrings/
sudo add-apt-repository contrib
sudo apt-get update
sudo apt-get -y install cuda-toolkit-12-3
```

I run `sudo apt install nvidia-driver` and reboot.

If trying to find the GPU with `nvidia-smi`, there is nothing found.

So, I need to ensure the GPU is detected.

```bash
sudo apt install nvidia-detect
nvidia-detect
```

I got this confusing error

```
Detected NVIDIA GPUs:
1b:00.0 VGA compatible controller [0300]: NVIDIA Corporation GA102 [GeForce RTX 3090] [10de:2204] (rev a1)

Checking card:  NVIDIA Corporation GA102 [GeForce RTX 3090] (rev a1)
Uh oh. Your card is not supported by any driver version up to 545.23.06.
A newer driver may add support for your card.
Newer driver releases may be available in backports, unstable or experimental.
```

There is no way that the latest driver doesn't support RTX 3090. I check whether it supports or not in [NVIDIA driver download page](https://www.nvidia.com/Download/driverResults.aspx/212964/en-us/). Of course, is supports.

## Solution

When I was confused and reboot the VM again and again, I found the key of the issue. I usually use ssh to connect the VM, but once I connected with VNC (VMRC), I see this error when booting:

```
[   12.699654] NVRM: loading NVIDIA UNIX x86_64 Kernel Module  530.41.03  Thu Mar 16 19:48:20 UTC 2023
[   12.762447] nvidia-modeset: Loading NVIDIA Kernel Mode Setting Driver for UNIX platforms  530.41.03  Thu Mar 16 19:23:04 UTC 2023
[   12.871331] [drm] [nvidia-drm] [GPU ID 0x00000b00] Loading driver
[   12.972022] ACPI Warning: \_SB.PCI0.PE50.S1F0._DSM: Argument #4 type mismatch - Found [Buffer], ACPI requires [Package] (20210730/nsarguments-61)
[   13.732645] NVRM: GPU 0000:0b:00.0: RmInitAdapter failed! (0x26:0x56:1474)
[   13.732697] BUG: unable to handle page fault for address: 0000000000004628
[   13.732784] NVRM: GPU 0000:0b:00.0: rm_init_adapter failed, device minor number 0
```

I found out the solution of this issue at [nvidia forum](https://forums.developer.nvidia.com/t/solved-rminitadapter-failed-to-load-530-41-03-or-any-nvidia-modules-other-than-450-236-01-linux-via-esxi-7-0u3-passthrough-pci-gtx-1650/253239/2).

In a word, I need to install the open kernel version not the default version. The answer in the forum show I can install the driver with `.run` file with argument `-m=kernel-open`.

> edit at Nov 8 2024:
>
> It is also possible to install the open kernel version in apt.

So, I cleaned the process installation.

```bash
sudo nvidia-uninstall
sudo apt purge -y '^nvidia-*' '^libnvidia-*'
sudo rm -r /var/lib/dkms/nvidia
sudo apt -y autoremove
sudo update-initramfs -c -k `uname -r`
sudo update-grub2
sudo reboot
```

And install the driver with open kernel.

```bash
sudo ./NVIDIA-Linux-x86_64-525.116.04.run -m=kernel-open
sudo update-initramfs -u
sudo reboot
```

Unfortunately, it still doesn't solve the problem, Still nothing can be found in `nvidia-smi`. But is does make some effect, there is no that error when booting.

After further searching, I finally find the solution in the [forum](https://forums.developer.nvidia.com/t/nvidia-smi-got-no-devices-were-found-after-nvidia-driver-525-installation-on-ubuntu-20-04-running-with-esxi8-0-passthrough-gtx1650/245142).

The solution is add one line of config in `/etc/modprobe.d/nvidia.conf` (if not exists, create the file).

```
options nvidia NVreg_OpenRmEnableUnsupportedGpus=1
```

Reboot, issue solved.

![result](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/cde3baea-80be-4404-0917-8b9d1b718900/small)