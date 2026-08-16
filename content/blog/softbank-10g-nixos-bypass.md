---
title: "Bypassing the SoftBank 光 10ギガ HGW with NixOS and systemd-networkd"
description: "Replacing the SoftBank 光 10ギガ HGW with a NixOS router. Reading the three tunnel parameters off a single captured packet, cloning the HGW's MAC, DUID, and IAID with systemd-networkd, and the two bugs that cost me a 40-second hang and a total outage every 4 hours."
pubDate: "Aug 17 2026"
tags:
 - Router
 - NixOS
heroImageId: "821f8dba-079e-4522-b781-88c7f3a58500"
heroImageSource: 'Pixiv'
heroImageSourceUrl: 'https://www.pixiv.net/artworks/137277047'
heroImageAuthor: 'Tinia'
heroImageAuthorUrl: 'https://www.pixiv.net/users/16148853'
---

*All personal addresses, prefixes, and MACs below are redacted — placeholders are marked with `X` or angle brackets.*

## TL;DR

- SoftBank 光 10ギガ is **neither DS-Lite nor MAP-E**, despite what most Japanese blog posts say. It is a plain RFC 2473 IPv4-in-IPv6 tunnel (`ip6tnl`, Next Header 4) with a **dedicated** global IPv4 — all 65535 ports are yours.
- The three parameters you need (BR address, CE address, public IPv4) can be read off a **single captured tunnel packet**. No RADIUS decoding, no vendor dictionary, no reverse engineering.
- You must clone the HGW's WAN MAC, pin its DHCPv6 DUID and DHCPv6 IAID. Cloning the MAC alone is not enough. Bindings key on both. Getting this wrong gave me a total outage every 4 hours, on the dot — see Part 9.
- It works on NixOS with `systemd.network`. Total config is about 40 lines.
- MSS clamping is mandatory, not optional — without it every first connection to an IPv4-only site hangs for 40 seconds.
- You must keep renting the HGW. This is a bypass, not a cancellation.

## Background

I have SoftBank 光 10ギガ in Nara (so NTT West, フレッツ光クロス underneath). SoftBank shipped me a **ホームゲートウェイ（S）**, model `10G E-WMTA1.0` — internally a Sercomm **EVO310G**. This is the newer single-box unit that SoftBank started shipping in April 2025; it replaces the older XG-100NE + 光BBユニット combination and folds both roles into one device.

That distinction matters, because nearly every existing write-up assumes an XG-100NE, and several of the tricks in those posts don't apply:

| | XG-100NE (older) | ホームゲートウェイ（S）/ EVO310G |
|---|---|---|
| Vendor | NTT (NEC) | SoftBank (Sercomm) |
| Hidden config page | `http://ntt.setup:8888/t/` | **does not exist** |
| Setup menu | `http://ntt.setup/` | `http://192.168.3.1/` |
| 4over6 provisioning | フレッツ・ジョイント software | its own RADIUS client + TFTP |

My router is a NixOS box with four interfaces:

- `enp1s0f0`, `enp1s0f1` — 10G SFP+
- `enp4s0` — 10G RJ45
- `enp7s0` — 1G RJ45

`enp1s0f1` is bridged into `br-lan`. Everything is configured with `systemd.network`, deployed from my workstation with `nixos-rebuild --target-host`.

## Part 1: What protocol is this, actually?

This is the question that wasted the most time up front, because the internet contradicts itself.

**The HGW's own status page says "MAP-E."** So bloggers repeat it. But packet captures published by others show plain IPIP encapsulation, and one researcher who dug into this concluded it's not "4rd/SAM" either — that's a rumour SoftBank has denied. What it actually is: the same RFC 2473 IPIP tunnel that JPIX/v6プラス uses for its *fixed-IP* contracts.

The reconciliation is simple. BBIX runs MAP-E **without IPv4 address sharing**. With no port-set sharing, the MAP algorithm degenerates into "encapsulate everything and send it to the BR" — i.e. a dumb tunnel. So the HGW isn't lying exactly; it's just that the interesting part of MAP-E is switched off.

DS-Lite is simply wrong. There's no AFTR and no CGN anywhere in the path.

The most useful confirmation I found was in [`luci-app-fleth`](https://github.com/makeding/luci-app-fleth), an OpenWrt helper for Japanese IPv4-over-IPv6 tunnels. It has three categories — DS-Lite, MAP-E, and 固定IP — and lists `SoftBank 光` (both 1G and 10G) under **固定IP**, served by its `IPIP6H` protocol. That's a maintained compatibility table saying, unambiguously, *not MAP-E, not DS-Lite*.

Also worth knowing: **フレッツ光クロス does not offer PPPoE at all.** There is no fallback path. If the tunnel doesn't work, you have IPv6 and nothing else.

### The silver lining

Because IPv6 works fine over plain DHCPv6-PD with no tricks, **a broken tunnel leaves you with a working IPv6 internet**. `cache.nixos.org` and `github.com` both have AAAA records. That turned out to be a meaningful safety net.

## Part 2: What you need to extract

| Value | Where it lives |
|---|---|
| Public IPv4 | HGW setup menu |
| CE IPv6 (tunnel local) | HGW setup menu |
| WAN MAC | device label |
| **BR IPv6 (tunnel remote)** | **nowhere — must be captured** |
| **DHCPv6 DUID** | **nowhere — must be captured** |
| **DHCPv6 IAID** | **nowhere — must be captured** |
| IA_PD T1/T2/lifetimes | the same capture — worth recording |

The first three are free. The rest require putting yourself on the wire between the ONU and the HGW.

**The IAID is the one everybody misses, and skipping it cost me two four-hour outages.** DHCPv6 bindings are keyed on **DUID + IAID**, not DUID alone. Get the DUID perfect and the IAID wrong and the server ignores you exactly as thoroughly as if you'd sent neither. See Part 9.

## Part 3: The capture

### Topology

I originally planned to use a spare port for a temporary uplink so the house stayed online during the capture. Then I realised: **`nixos-rebuild --target-host` builds on the workstation and pushes the closure over the LAN. The router never needs internet to be reconfigured.** Tethering the workstation to my phone was enough, which freed both RJ45 ports for the tap.

```
ONU ──────► enp4s0 (10G) ┐
                         ├─ br-tap  (no IP, no STP)
HGW WAN ◄── enp7s0 (1G)  ┘

switch ◄─── enp1s0f1 ──── br-lan
```

The ONU cable goes into its permanent home (`enp4s0`) on day one and never moves again. At cutover you just unplug the HGW. Speed mismatch across the bridge is fine — the HGW's WAN port autonegotiates down, and DHCPv6/RADIUS are a few hundred bytes.

Cost: the LAN has no internet for the duration. Budget 20 minutes.

### Tap config

```nix
systemd.network.netdevs."05-br-tap" = {
  netdevConfig = { Name = "br-tap"; Kind = "bridge"; };
  bridgeConfig = { STP = false; VLANFiltering = false; };
};

systemd.network.networks."05-tap-members" = {
  matchConfig.Name = "enp4s0 enp7s0";
  networkConfig = { Bridge = "br-tap"; LinkLocalAddressing = "no"; };
  linkConfig.RequiredForOnline = "no";
};

systemd.network.networks."05-br-tap" = {
  matchConfig.Name = "br-tap";
  networkConfig = { DHCP = "no"; LinkLocalAddressing = "no"; IPv6AcceptRA = false; };
  linkConfig.RequiredForOnline = "no";
};

environment.systemPackages = with pkgs; [ tcpdump tshark ethtool ];
boot.blacklistedKernelModules = [ "br_netfilter" ];
```

Blacklisting `br_netfilter` matters: if it loads, your nftables rules start inspecting bridged frames and can silently eat the HGW's traffic, which looks exactly like "the tap is broken."

> Do **not** clone the MAC yet. While `enp4s0` is a bridge port it has no address of its own and forwards frames unmodified — that's what makes the tap transparent. Cloning now would put two devices with the same MAC on one segment and thrash the bridge FDB.

### Getting the BR address

This is the part I over-thought. Everyone describes sniffing the RADIUS `Access-Accept` and hex-decoding vendor attributes 204 and 207. You don't have to. **One tunnel packet contains everything:**

```
$ sudo tcpdump -nn -i br-tap -c 20 'ip6 proto 4'

IP6 2400:2000:4:0:a000::XXXX > 2400:2650:XXXX:XXXX:1111:1111:1111:1111: \
    IP 198.51.100.42.44424 > <MY_IPV4>.10000: Flags [S], seq ..., length 0
    ^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    BR = tunnel Remote       CE = tunnel Local          inner: your IPv4
```

No HGW reboot needed — this traffic flows constantly. Cross-check the CE address and IPv4 against the HGW's setup menu; three-way agreement means you're done.

### Things the capture told me for free

**The IPv4 really is dedicated.** Almost everything in my capture was inbound scan traffic — SYNs to ports 10000, 8181, 63500, 3128, 31038, 19998 from hosts all over the world. Boring in itself, but a positive result: on a port-sharing MAP-E deployment you would only see packets landing in your assigned port range. Arbitrary low and high ports arriving means all 65535 are mine. That settles the MAP-E question empirically, for my line, without trusting anyone's blog post.

> This is background radius of internet. Hackers may use your device to launch attack on someone else or your other devices. Keep you firewall on at public direction.

**The BR block.** Mine lives in `2400:2000:4:0:a000::/64`. Others have published `::1919` and `::1999` from that same /64. Different host, same BBIX block — consistent with per-region BRs. Yours will differ; capture your own.

**The HGW phones home over the tunnel.** A TFTP read request for `10gewmta.sc` to a host in `221.111.x.x`. Independent confirmation of the model, and evidence that provisioning on this box isn't purely RADIUS-driven.

**It answers scanners with RST, not DROP.** Which is a good reminder that the moment your router inherits that IPv4, it inherits an actively-probed public address.

### Getting the DHCPv6 identity: DUID *and* IAID

This one does need an HGW power cycle, since DHCPv6 only runs at boot:

```sh
sudo tcpdump -nn -i enp4s0 -w /tmp/sb.pcap \
  'udp port 546 or udp port 547 or udp port 1812 or udp port 1813'
# power-cycle the HGW, wait for it to come fully up, Ctrl-C

tshark -r /tmp/sb.pcap -Y 'dhcpv6.msgtype == 1' -V
```

Don't grep for just the Client Identifier — dump the whole Solicit. You need three things out of it.

**1. The DUID:**

```
Client Identifier
    Option: Client Identifier (1)
    Length: 10
    DUID: 00030001982cc6XXXXXX
    DUID Type: link-layer address (3)
    Hardware type: Ethernet (1)
    Link-layer address: 98:2c:c6:XX:XX:XX
    Link-layer address (Ethernet): SernetTechno_XX:XX:XX
Reconfigure Accept
    Option: Reconfigure Accept (20)
```

DUID-LL (type 3) wrapping the WAN MAC. `98:2c:c6` is Sercomm's OUI, confirming EVO310G.

**2. The IAID:**

```
Identity Association for Prefix Delegation
    Option: Identity Association for Prefix Delegation (25)
    Length: 12
    IAID: 00000001
    T1: 0
    T2: 0
```

`IAID: 00000001`. systemd-networkd derives its IAID from a hash of the interface name, so yours will be some arbitrary value with no relationship to the HGW's. **The server keys the binding on DUID + IAID.** A perfect DUID with a mismatched IAID gets you exactly nothing.

Note also that the Solicit carries **only IA_PD** — no IA_NA. Match that with `UseAddress = false`, or you're asking for something the server doesn't hand out on this line.

**3. The lease lifetimes**, from the Reply:

```sh
tshark -r /tmp/sb.pcap -Y 'dhcpv6.msgtype == 7' -V | grep -A12 'Prefix Delegation'
```

Mine: T1 7200, T2 10800, preferred 12600, **valid 14400**. Write that number down. It is the length of the fuse on the failure in Part 9, and knowing it in advance turns a baffling outage into a five-minute diagnosis.

### The DUID byte-layout trap

This burned four hours of my life twice, so it gets its own heading.

`DUIDRawData` in systemd-networkd is the **payload after the 2-byte type field**. networkd writes the type itself, derived from `DUIDType`. Feed it the full DUID and it stacks its own type field on top:

```
HGW    (Length: 10)  00 03  0001982cc6XXXXXX
Router (Length: 12)  00 03  00030001982cc6XXXXXX      ← WRONG
                     ^^^^^  ^^^^^^^^^^^^^^^^^^^^^^
                     type   what I put in DUIDRawData
                 prepended
                 by networkd
```

| | bytes |
|---|---|
| Full DUID on the wire | `0003` `0001` `982cc6XXXXXX` |
| `DUIDType = "link-layer"` supplies | `0003` |
| `DUIDRawData` must be | `0001982cc6XXXXXX` — **8 bytes** |

The `00:01` that stays is the **hardware type** (Ethernet), not part of the DUID type. Same value pattern, different field, one byte-pair apart — which is exactly why this is easy to get wrong and nearly invisible once written.

The fastest check is the length, before you read a single hex digit: `Length: 10` is right, `Length: 12` means your payload is too long.

**Why you need any of this and not just the MAC:** NTT's DHCPv6-PD server keys on DUID + IAID. systemd-networkd defaults to DUID-EN (vendor-based) plus a name-hashed IAID, which will not get you your `/56` no matter what MAC you're presenting. The DUID *contains* the MAC, so pinning MAC, DUID, and IAID is consistent, not redundant.

Also note `Reconfigure Accept` in that Solicit — file it away, it matters later.

Copy the pcap off the router before tearing anything down. You will want it at 2am when the tunnel won't come up and the HGW is no longer in the path. I went back to mine three separate times.

## Part 4: The NixOS config

```nix
{ lib, pkgs, ... }:
let
  wanIf   = "enp4s0";
  hgwMac  = "98:2c:c6:XX:XX:XX";
  # payload ONLY — networkd prepends the 2-byte type field itself.
  # Captured DUID is 00:03:00:01:98:2c:c6:XX:XX:XX; drop the leading 00:03.
  hgwDuid = "00:01:98:2c:c6:XX:XX:XX";
  ceAddr  = "2400:2650:XXXX:XXXX:1111:1111:1111:1111";
  brAddr  = "2400:2000:4:0:a000::XXXX";
  myV4    = "<MY_IPV4>";
in
{
  boot.kernelModules = [ "ip6_tunnel" ];

  # WAN: clone MAC, pin DUID, take RA + PD, attach the tunnel
  systemd.network.networks."10-wan" = {
    matchConfig.Name = wanIf;
    linkConfig.MACAddress = hgwMac;
    networkConfig = {
      IPv6AcceptRA = true;
      DHCP = "ipv6";
      LinkLocalAddressing = "ipv6";
      Tunnel = [ "sbtun" ];
    };
    address = [ "${ceAddr}/64" ];
    dhcpV6Config = {
      DUIDType = "link-layer";
      DUIDRawData = hgwDuid;
      IAID = 1;                 # from the HGW's Solicit — NOT networkd's default
      PrefixDelegationHint = "::/56";
      UseAddress = false;       # the HGW asks for IA_PD only, no IA_NA
      UseDNS = false;
      WithoutRA = "solicit";
    };
  };

  # The tunnel itself
  systemd.network.netdevs."20-sbtun" = {
    netdevConfig = { Name = "sbtun"; Kind = "ip6tnl"; MTUBytes = "1460"; };
    tunnelConfig = {
      Mode = "ipip6";
      Local = ceAddr;
      Remote = brAddr;
      EncapsulationLimit = "none";
    };
  };

  systemd.network.networks."20-sbtun" = {
    matchConfig.Name = "sbtun";
    address = [ "${myV4}/32" ];
    routes = [ { Destination = "0.0.0.0/0"; Scope = "link"; } ];
  };
}
```

### Set the MAC in `[Link]` of the `.network`, not a `.link` file

This is worth calling out. `.link` files are applied by **udev at device-add time**, so a `nixos-rebuild switch` will not reapply one to an interface that already exists — you need `udevadm trigger --action=add` or a reboot. `[Link] MACAddress=` inside a `.network` file is applied by networkd itself and takes effect on reload.

"Why didn't my MAC change" is a miserable thing to debug with no uplink. A stale `.link` file also silently wins over the `.network` setting, so if you followed a guide that used one, delete it.

The interface name doesn't change when the MAC does — `enp4s0` is derived from the PCI path, not the address.

### `EncapsulationLimit = "none"` is not optional

By default the kernel adds an IPv6 Destination Options header carrying a tunnel encapsulation limit. Some BRs drop those. Check with `ip -d link show sbtun`: if it says `encaplimit 4` instead of `encaplimit none`, that's your bug. This is the classic cause of "tunnel is up, nothing passes."

(`ip -d` will report the mode as `ip4ip6`. That's the same thing you configured as `Mode=ipip6`, not an error.)

## Part 5: The firewall — the part that actually matters

My pre-existing config was:

```nix
networking.firewall = {
  enable = true;
  trustedInterfaces = [ "br-lan" "tailscale0" ];
  checkReversePath = "loose";
};
```

With no `allowedTCPPorts` anywhere, the input chain defaults to drop on every untrusted interface. Netdata was bound to `0.0.0.0:19999` but reachable only from LAN and Tailscale. That held up fine.

Three things change at cutover.

**1. `nat.externalInterface` must move to `sbtun`, obviously.** Masquerading on `enp4s0` would be applied to an interface carrying only IPv6 and encapsulated frames; LAN traffic would leave the tunnel with RFC1918 sources and vanish.

**2. Default-deny will silently kill your tunnel.** Encapsulated return traffic arrives as an IPv6 packet with next header 4, and netfilter's input hook runs *before* the kernel hands it to the decapsulator. The drop policy eats it. `sbtun` shows UP and counts zero RX. You must allow protocol 4 explicitly:

```nix
networking.nftables.enable = true;
networking.firewall.extraInputRules = ''
  # proto 4 = IPv4-in-IPv6 (RFC 2473) from the BBIX BR
  ip6 saddr ${brAddr} meta l4proto 4 accept
'';
```

> **Gotcha:** `meta l4proto ipencap` does not compile — you get `Error: Could not resolve protocol name`. nftables resolves `l4proto` names from a small built-in table (`tcp`, `udp`, `icmp`, `icmpv6`, `sctp`, `dccp`, `ah`, `esp`, `comp`, `udplite`), *not* from `/etc/protocols`. Anything outside that list must be numeric. Same trap applies to GRE (47) and 6in4 (41).

**3. Your LAN loses its IPv6 firewall entirely.** This is the real exposure and it is invisible in the config. Once you're delegating a `/56` and sending RAs, every LAN device gets a globally routable address — and `networking.firewall` only filters the *input* chain by default. Forwarded traffic passes unfiltered. No NAT is accidentally protecting anything.

Given how many scanners were already hammering that IPv4 in my capture:

```nix
networking.firewall.filterForward = true;
networking.firewall.extraForwardRules = ''
  iifname "br-lan" accept
  ct state established,related accept
'';
```

Keep `checkReversePath = "loose"`. Strict RPF and a `/32` on a point-to-point tunnel with an on-link default route do not get along.

> Verify the firewall from outside, not from the LAN
>
> ```sh
> nmap -Pn -p 22,19999,80,443 <MY_IPV4>
> nmap -6 -Pn -p 22,19999 <a LAN device's global IPv6>
> ```
>
> The second one is the test that actually matters, and it's the one people skip. Run both from a phone hotspot — you won't have NAT loopback until you configure it, so testing from inside proves nothing.

## Part 6: Deploying without internet

The premise worth attacking: **the router never needs internet to be rebuilt.** `nixos-rebuild --target-host` evaluates and builds entirely on the workstation and pushes the closure over SSH on the LAN. The router is a dumb recipient.

```sh
# once, while online — pull inputs and prebuild the closure
nix flake archive
nix build .#nixosConfigurations.router.config.system.build.toplevel

# then, offline-safe
nixos-rebuild switch --flake .#router --target-host root@<router> --fast
```

Only *adding a new dependency* needs the network. Config-only edits rebuild from the local store.

Safe iteration loop:

```sh
# 1. apply without touching the bootloader
nixos-rebuild test --flake .#router --target-host root@<router>

# 2. arm a dead-man's switch — reboot returns to last known-good
ssh root@<router> 'systemd-run --on-active=10min --unit=deploy-watchdog systemctl reboot'

# 3. if it works
ssh root@<router> 'systemctl stop deploy-watchdog.timer'
nixos-rebuild switch --flake .#router --target-host root@<router>
```

Because `test` doesn't update the boot entry, a reboot *is* the rollback. No rollback logic to write. `deploy-rs` with `magicRollback = true` automates the same dance if you'd rather not hand-roll it.

Two more things that shorten the loop a lot:

- **Don't rebuild to test the tunnel.** It's five `ip` commands. Iterate in a shell until packets flow, *then* translate to Nix once.
- **Use a specialisation** for the risky config, so the boot default stays the known-good state and a power cycle is the escape hatch.

## Part 7: Cutover checklist

Before unplugging the HGW:

- BR IPv6 recorded from `ip6 proto 4` source
- CE IPv6 copied **verbatim** — don't invent an interface ID
- Public IPv4 matches the HGW setup menu
- WAN MAC recorded (and the burned-in MAC saved via `ethtool -P`, for reverting)
- DHCPv6 Client Identifier bytes recorded — **payload is 8 bytes, not 10**
- **DHCPv6 IAID recorded** (IA_PD option, same Solicit)
- IA_PD T1/T2/preferred/valid lifetimes noted — the valid lifetime is your fuse length
- `ls /etc/systemd/network/*.link` — no strays renaming the WAN interface
- pcap copied off the router
- `ss -tlnp` audited for anything bound to `0.0.0.0` / `::`
- Closure prebuilt on the workstation
- Phone tethered

Verification order after activation:

```sh
ip link show enp4s0 | grep ether     # cloned MAC
networkctl status enp4s0             # a /56 arrived
ip -6 addr show enp4s0 | grep 1111   # ceAddr present
ip -d link show sbtun                # encaplimit none, correct local/remote
ip -s link show sbtun                # RX climbing, not just TX
ip route get 8.8.8.8                 # dev sbtun
ping -c3 8.8.8.8
```

Diagnostic shortcuts:

- **No `/56`** → DUID or MAC mismatch. Check `journalctl -u systemd-networkd -b | grep -i dhcp`.
- **`/56` but no IPv4** → `EncapsulationLimit` missing, or `Local=` doesn't match `ceAddr` exactly.
- **TX climbing, RX flat** → firewall eating protocol 4, or the BR rejecting your source address.
- **Test with `ping 8.8.8.8`, not `ping google.com`.** With `UseDNS = false` on both interfaces, name resolution fails independently of whether the tunnel works.

## Part 8: First bug — every first request to an IPv4-only site hung

Symptom: opening a site with no AAAA record hung for ~40 seconds. Retry, on any machine, was instant. It looks like a DNS issue, but wasn't.

> This blog only doesn't have AAAA record. You can test with this blog.

The tell is that it tracked exactly with "does this site have IPv6" — dual-stack sites were fine because that path is native `enp4s0` at MTU 1500 with no encapsulation. Only IPv4 goes through `sbtun` at 1460.

`tcpdump -nn -i sbtun` during a hang:

```
SYN         options [mss 1460, ...]        ← the bug is right here
SYN-ACK     options [mss 1460, ...]
ACK
PSH 1:1561  (ClientHello)                  ← outbound fine
ACK 1409 / ACK 1561                        ← server received it all

PSH seq 5793:5830, length 37               ← 37 bytes, arrives fine
ACK 1, sack {5793:5830}                    ← "I have byte 1, and 5793-5830"
```

Bytes 1–5792 — the ServerHello and certificate chain — never arrived. Only the tiny 37-byte tail got through. **Small packets pass, full-size ones vanish, no ICMP.** Then ~63 seconds of a stuck window, a FIN, and a RST.

The `sack` block is the signature. If you see a SACK for a high range while the ACK is still stuck at 1, you are looking at a PMTU black hole, not a slow server.

Mechanism: the client advertises MSS 1460 from its own 1500-byte MTU. The server sends 1460-byte payloads. The BR must wrap those in a 40-byte IPv6 header — 1540 bytes — which exceeds the path MTU, so it drops them. Whether ICMP Fragmentation Needed gets generated is moot; enough of the internet drops ICMP that it never reaches the sender.

Retries succeed because Linux caches a PMTU entry after the first stall. So you pay one 40-second timeout per destination, per machine, per cache lifetime — which is exactly the "first load hangs, second is instant" pattern.

Fix:

```nix
networking.nftables.tables.clamp = {
  family = "inet";
  content = ''
    chain forward {
      type filter hook forward priority mangle; policy accept;
      tcp flags syn / syn,rst oifname "sbtun" tcp option maxseg size set rt mtu
      tcp flags syn / syn,rst iifname "sbtun" tcp option maxseg size set rt mtu
    }
    chain output {
      type route hook output priority mangle; policy accept;
      tcp flags syn / syn,rst oifname "sbtun" tcp option maxseg size set rt mtu
    }
  '';
};

boot.kernel.sysctl."net.ipv4.tcp_mtu_probing" = 1;
```

Three deliberate choices:

- `size set rt mtu` derives from the route MTU rather than hardcoding 1420. Change `MTUBytes` later and this follows automatically.
- **Both** `oifname` and `iifname` on forward. The first fixes what you advertise; the second rewrites the *server's* advertisement before it reaches your LAN client, so neither end can overshoot.
- A separate `output` chain with `type route hook output` for traffic originating on the router itself.

Verify with `tcpdump -i sbtun 'tcp[tcpflags] & tcp-syn != 0'` — SYNs should now carry `mss 1420`. Run `ip route flush cache` first, or you'll be testing the cached PMTU rather than the fix.

## Part 9: Second bug — total outage every 4 hours, exactly

This is the one that nearly beat me, and the fix is a single missing field.

### What happened

Roughly four hours after cutover, all internet stopped. Not degraded — gone.

```
9: sbtun@enp4s0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1460 ...
    RX:  bytes packets errors dropped  missed   mcast
             0       0      0       0       0       0
    TX:  bytes packets errors dropped carrier collsns
        269687    4060    164     164     164       0
```

RX exactly zero, TX with carrier errors. Rebooting the ONU and the router did not help.

- `ping6` to the BR failed
- **No Router Advertisements arriving at all** (`tcpdump -nn -i enp4s0 'icmp6 && ip6[40] == 134'` → silence)
- No dynamic SLAAC address
- Nothing in the networkd journal mentioning DHCP, renew, or rebind
- Unfiltered `tcpdump -i enp4s0` showed plenty of traffic — but **100% outbound**

Recovery: plug the HGW back into the ONU, let it come up, reconnect the router. No configuration change involved.

### The clue that cracked it

It happened again — **exactly four hours after the HGW last connected**, not four hours after my router booted.

That anchor is everything. 4 hours = 14400 seconds = the IA_PD **valid lifetime** from the capture. The countdown I was watching belonged to the lease the *HGW* established. My router never renewed it, because my router never had it.

So: I had been riding an inherited binding the whole time. At expiry the subscriber session tore down upstream — which is why **RAs stopped**, not merely the tunnel. That was the observation that never fit any of my earlier theories, since RAs are unsolicited multicast and require no state on the client side. Reconnecting the HGW re-established the binding and restarted the same four-hour fuse.

### Why the router never got its own lease

`networkctl reconfigure enp4s0` with a capture running:

```
1   0.000000 fe80::9a2c:... → ff02::1:2  DHCPv6 Solicit XID: 0x6f1749 CID: 000300030001982cc6XXXXXX
2   1.070431 fe80::9a2c:... → ff02::1:2  DHCPv6 Solicit XID: 0x6f1749 CID: 000300030001982cc6XXXXXX
3   3.184200 ...
4   7.368770 ...
5  15.473139 ...
6  31.498594 ...
7  61.963827 ...
8 121.580047 ...
```

Retransmit backoff at 1/2/4/8/16/32/64/128s with **zero Replies**. The server was ignoring an unrecognised client outright.

Two defects, both in the client identity:

**`CID: 000300030001982cc6XXXXXX` — 12 bytes with `0003` twice.** The DUID byte-layout trap from Part 3: I put the full 10-byte DUID into `DUIDRawData`, and networkd prepended its own type field.

**IAID mismatch.** I'd extracted the DUID and stopped, never noticing the HGW's `IAID: 00000001` sitting a few lines below it in the same Solicit. networkd hashes the interface name for its default. Bindings key on DUID **and** IAID.

### The fix

```nix
dhcpV6Config = {
  DUIDType = "link-layer";
  DUIDRawData = "00:01:98:2c:c6:XX:XX:XX";   # 8 bytes, not 10
  IAID = 1;
  PrefixDelegationHint = "::/56";
  UseAddress = false;
  UseDNS = false;
  WithoutRA = "solicit";
};
```

Verify before waiting four hours:

```sh
sudo tcpdump -nn -i enp4s0 -w /tmp/v2.pcap 'udp port 546 or udp port 547' &
networkctl reconfigure enp4s0
sleep 20 && sudo pkill tcpdump
tshark -r /tmp/v2.pcap
```

Success is `Solicit → Advertise → Request → Reply`, with `Length: 10` on the Client Identifier. Eight unanswered Solicits means you're still not being recognised.

Afterwards, `journalctl -u systemd-networkd` finally mentions DHCPv6 at all, and `ip -6 addr show enp4s0` shows a dynamic entry alongside the static one. The router now holds its own lease and renews at T1 (7200s), so the four-hour fuse is gone.

### A third bug the same logs exposed

```
enp4s0: Interface name change detected, renamed to eth0.
```

A leftover `.link` file from an earlier iteration was renaming the WAN interface. It hadn't broken anything yet — networkd kept matching on the old name — but `matchConfig.Name = "enp4s0"` would eventually have matched nothing at all. Check for and delete strays:

```sh
ls -la /etc/systemd/network/*.link
```

The MAC belongs in `[Link]` of the `.network`, as in Part 4.

### The diagnostic lesson

**A static `address =` line makes your interface look configured when it isn't.**

I spent hours reassured by `ip -6 addr show enp4s0` displaying my CE address, treating it as evidence that DHCPv6 had worked. It wasn't. That address is hardcoded in the `.network` file — networkd installs it whether or not a single DHCPv6 packet was ever answered. I was reading my own config back at myself.

The real signals are: a *second*, dynamic address with finite lifetimes; a delegated prefix in `networkctl status`; and DHCPv6 appearing in the journal at all. Its total absence from the logs should have been the first thing I chased, not the last.

Corollary worth internalising: **an outage anchored to another device's clock is not your bug's clock.** The first outage looked like 3 hours because I measured from my cutover; it was 4 hours from the HGW's last provisioning. Measuring from the wrong event sent me chasing T2 rebind timers that never applied.

## Part 10: The other unexplained thing

First activation: no connectivity. Reboot: everything works. Same generation, no config change.

Most likely explanation: the `ip6tnl` netdev was created before `ceAddr` was configured on `enp4s0`. `ip6tnl` binds `local` at creation time, and networkd doesn't reliably order netdev creation after address configuration on the underlying link. So the tunnel came up sourcing from the wrong address (or nothing), and the BR ignored it. The reboot happened to serialise it correctly.

If that's the cause, it will recur on a cold boot with slow link negotiation. Check `ip -d link show sbtun` — if `local` isn't exactly your CE address, you're working by luck. The deterministic fix is likely:

```nix
systemd.network.netdevs."20-sbtun".tunnelConfig.Independent = true;
```

which decouples tunnel creation from the underlying link's state. **Not yet verified** — test it on a `test` activation you can reboot out of.

Alternative explanation: the HGW still held the BBIX session and the reboot simply bought elapsed time. Less likely given it was already unplugged, but it would produce identical symptoms with no config defect at all.

## Caveats

- **You must keep renting the HGW — and keep it reachable.** IPv6高速ハイブリッド is bundled with the rental, so cancelling kills the service. But as Part 9 shows, it's also your only recovery mechanism: it's the one device that can re-establish the BR binding from scratch. Don't put it somewhere inconvenient.
- **Budget for a multi-day debugging tail.** Mine took three distinct bugs to stabilise, one of which only revealed itself on a 4-hour cycle. Don't cut over the day before you need the connection.
- **ひかり電話 / ホワイト光電話 stops working.** There's no way to keep the phone and bypass the router, since you can't have both devices on the ONU with the same cloned MAC.
- **This is almost certainly outside SoftBank's terms.** They will not support it.
- **Region matters.** Published reports are mostly 東日本 with an XG-100NE. I'm 西日本 with an EVO310G. The architecture is the same; the addresses are not. Capture your own.
- **Firmware can change any of this.** The parameters are fetched dynamically by the HGW for a reason.

## References

- [`makeding/luci-app-fleth`](https://github.com/makeding/luci-app-fleth) — OpenWrt helper; its ISP table is the clearest published statement that SoftBank is 固定IP/IPIP6, not MAP-E or DS-Lite
- [Missing's Blog — SoftBank 光・10ギガ移除NTT路由器直接桥接ONU](https://blog.missing233.com/2023/08/13/softbank-hikari-research/) and [the follow-up config guide](https://blog.missing233.com/2023/09/16/softbank-hikari-openwrt-configuration/) — the original reverse-engineering, including the RADIUS VSA 204/207 decode and the 8-hour DHCPv6 problem
- [zenn.dev/zyun — ソフトバンク光の10Gプラン](https://zenn.dev/zyun/scraps/d6d3781094804a) — packet capture showing plain IPIP despite the HGW's "MAP-E" label
- [塩の惑星 — 大容量回線ソフトバンク光10GでIPv6,IPv4の自宅サーバ運用をしてみた](https://corkborg.github.io/home-server-with-softbank-hikari-10g/) — the dedicated-IPv4 finding, from the XG-100NE side
- [RFC 2473](https://datatracker.ietf.org/doc/html/rfc2473) — Generic Packet Tunneling in IPv6
