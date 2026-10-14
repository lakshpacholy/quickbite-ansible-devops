# QuickBite: DevOps Case Study & Ansible Automation

Automated deployment of **QuickBite**, a small food-delivery backend, using Ansible.
A Node.js (Express) API runs as a systemd service behind an Nginx reverse proxy and
stores its menu and orders in PostgreSQL. Ansible installs and configures all three tiers.

**Student:** Laksh Pacholy (PRN 202301040263)

## Scenario and DevOps lifecycle

QuickBite is analysed across eight DevOps stages: Plan, Code, Build, Test, Release,
Deploy, Operate and Monitor. The **Deploy** and **Operate** stages are implemented with
Ansible in this repository. The other stages (issue tracking, Git workflow, npm build,
automated tests, GitHub Actions CI, Prometheus/Grafana monitoring) are described in the
report as design only.

## Repository structure

```
.
├── ansible.cfg
├── site.yml                  # master playbook (3 plays)
├── inventory/
│   ├── hosts.ini             # remote servers (web1, web2, db1)
│   └── local.ini             # single-machine run used in the demo
├── group_vars/
│   ├── all.yml               # app + database settings shared by all hosts
│   ├── webservers.yml        # Nginx port and firewall ports
│   └── dbservers.yml         # menu seed data for the database
└── roles/
    ├── common/               # packages, app user, firewall, hostname
    ├── postgres/             # PostgreSQL, app user, database, tables, seed data
    ├── nodeapp/              # Node.js API, npm install, env file, systemd service
    └── nginx/                # Nginx reverse proxy (template + validation)
```

## What the playbook does

1. **common** (all hosts): updates apt, installs baseline packages, creates the app user,
   and on remote hosts sets the hostname and opens the firewall.
2. **postgres** (dbservers): installs PostgreSQL, creates the application user and
   database, creates the `menu_items` and `orders` tables, and seeds the menu once.
3. **nodeapp** (webservers): installs Node.js, copies the API, runs `npm install`,
   writes the environment file with the database settings, renders the systemd unit
   from a template, then enables and starts the service.
4. **nginx** (webservers): installs Nginx, deploys the reverse-proxy config on port 8080,
   validates it with `nginx -t`, and enables and starts the service.
5. A final check calls `/health` and `/menu` through Nginx and prints where the menu
   was served from.

## Ansible concepts used

Inventory with groups and a group of groups, group variables, roles, Jinja2 templates,
handlers, idempotency (including a "seed once" database check), configuration validation
before reload, and a secrets file with restricted permissions.

## How to run

Requirements: Ubuntu 22.04/24.04 (or WSL2 with systemd) and Ansible installed
(`sudo apt install -y ansible`).

```bash
ansible-inventory -i inventory/local.ini --graph
ansible-playbook -i inventory/local.ini site.yml --syntax-check
ansible-playbook -i inventory/local.ini site.yml --ask-become-pass
```

For real remote servers, edit the IPs and user in `inventory/hosts.ini` and run:

```bash
ansible-playbook -i inventory/hosts.ini site.yml
```

## Verify

```bash
curl http://localhost:8080/health
curl http://localhost:8080/menu
curl -X POST -H 'Content-Type: application/json' -d '{"item_id":1,"quantity":2}' http://localhost:8080/orders
curl http://localhost:8080/orders
systemctl status quickbite nginx --no-pager
sudo -u postgres psql -d quickbite -c 'select * from menu_items;'
```

## Notes

- The playbook is idempotent: a second run reports `changed=0`.
- The database password in `group_vars/all.yml` is a demo value. In production it
  belongs in Ansible Vault.
- Execution screenshots and the full analysis are in the project report, and a recorded
  demonstration is submitted separately.
