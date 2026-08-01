---
title: 'Deploying Real Services on a Hobby Budget'
description: 'What actually stays up on a $6 VPS: a Whisper API, a scraper fleet, and a blog, run for less than a coffee a month by being ruthless about what runs where.'
pubDate: 2023-04-15
tags: ['infrastructure', 'essay']
---

My monthly infrastructure bill for a FastAPI scraper service, a Whisper
transcription API, a Postgres instance, and this blog is less than what a
latte costs where I live. None of it feels like a demo. All of it takes
real traffic. The trick isn't a special discount — it's refusing to pay
for anything the workload doesn't need.

## Start from the workload, not the price list

The instinct when you're budget-constrained is to shop for the cheapest
VPS and then figure out what fits. That's backwards. You end up
undersizing the one thing that matters (RAM for a model, or IOPS for a
database) and oversizing everything else out of habit.

Instead, profile first. A scraper fleet is bursty and CPU-light —
mostly waiting on sockets, occasionally parsing JSON. A Whisper API is
the opposite: idle most of the time, then a spike that wants every core
and as much RAM as the model needs, for exactly as long as the audio is.
Those two profiles do not want the same box.

```text
scraper worker:    0.5 vCPU steady, bursty I/O, low RAM
whisper (base.en): idle 95% of the time, then 2-4 cores + ~2GB for 30-90s
postgres:          small but wants persistent, fast disk, not burstable
static blog:        basically free — a CDN edge, not a server at all
```

Four workloads, four different shapes. Putting them all on one general
purpose box means you're paying for the peak of all four at once, all
the time.

## Separate the "always on" from the "bursts"

The single biggest lever: anything that's idle most of the time should
not live on a box you pay for by the hour, 24/7.

- The **blog** is static output from a build step. It doesn't need a
  server. A CDN-backed static host serves it for effectively nothing —
  no compute, just bandwidth, and traffic for a personal blog doesn't
  come close to a paid tier.
- The **Whisper API** only burns real resources while it's transcribing.
  If requests are sparse, a queue plus a worker that scales to zero
  between jobs beats a GPU box billed by the month. If requests are
  steady enough to justify a always-on box, a small always-on instance
  with swap as a pressure valve is cheaper than provisioning for the
  worst case.
- The **scraper fleet** and the **API + Postgres** are the parts that
  are genuinely always-on, so that's where the one paid VPS goes.

```bash
# a cron-driven backup that costs nothing extra: nightly pg_dump,
# compressed, shipped to object storage — no managed backup tier needed
0 3 * * * pg_dump -Fc mydb | gzip | \
  aws s3 cp - s3://backups/mydb-$(date +\%F).dump.gz --endpoint-url "$S3_ENDPOINT"
```

That one line replaces a managed-database backup add-on that often costs
more than the database itself.

## Swap, systemd, and other things that replace a bigger plan

A $6 VPS usually means 1 vCPU and 1GB of RAM. That's tight for a Python
service plus Postgres plus a reverse proxy. Two habits make it work
instead of forcing an upgrade:

1. **Add swap, even on SSD-backed hosts.** A gigabyte of swap turns "OOM
   killer eats my API mid-request" into "briefly slower, then fine." It's
   not a substitute for enough RAM under sustained load, but it absorbs
   the spikes that would otherwise be a 502.

```bash
fallocate -l 1G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

2. **Let systemd be the process manager, not a container orchestrator
   you don't need.** A `Restart=on-failure` unit with a `MemoryMax`
   cap gives you crash recovery and resource limits without the
   overhead — in RAM and in cognitive load — of running Kubernetes for
   three services.

```ini
[Service]
ExecStart=/opt/venv/bin/uvicorn app:api --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=2
MemoryMax=700M
```

That `MemoryMax` line matters more than it looks. It's the difference
between one runaway request slowly starving Postgres of RAM and that
request getting killed and restarted while the database stays fine.

## Takeaway

Budget infrastructure isn't about finding a cheaper vendor — it's about
refusing to pay hourly for things that are idle most of the time, and
being honest about which workload actually needs the paid box. Put the
static site on a CDN, let the bursty GPU work scale to zero, and spend
the one real VPS bill on the thing that's actually always on. Everything
else is a rounding error.
