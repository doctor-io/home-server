"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronRight } from "lucide-react"

type TermLine = {
  type: "input" | "output" | "error" | "info" | "welcome"
  content: string
  prompt?: string
}

const HOSTNAME = "serverlab"
const USER = "admin"

function getPrompt(cwd: string) {
  return `${USER}@${HOSTNAME}:${cwd}$`
}

// Simulated filesystem for ls/cd
const virtualFS: Record<string, string[]> = {
  "~": ["Documents", "Downloads", "docker", "scripts", "backups", ".bashrc", ".ssh"],
  "~/Documents": ["notes.md", "server-plan.txt", "network-diagram.png"],
  "~/Downloads": ["ubuntu-22.04.iso", "portainer-agent.tar.gz"],
  "~/docker": ["compose.yml", "docker-compose.override.yml", ".env", "data"],
  "~/docker/data": ["postgres", "redis", "nginx"],
  "~/scripts": ["backup.sh", "update-containers.sh", "monitor.py", "deploy.sh"],
  "~/backups": ["2025-02-15-full.tar.gz", "2025-02-22-incremental.tar.gz"],
  "~/.ssh": ["authorized_keys", "id_ed25519", "id_ed25519.pub", "known_hosts", "config"],
}

// Simulate command output
function simulateCommand(
  input: string,
  cwd: string
): { output: TermLine[]; newCwd: string } {
  const parts = input.trim().split(/\s+/)
  const cmd = parts[0]
  const args = parts.slice(1)
  let newCwd = cwd

  if (!cmd) return { output: [], newCwd }

  switch (cmd) {
    case "help":
      return {
        output: [
          {
            type: "info",
            content: `Available commands:
  help          Show this help message
  ls [path]     List directory contents
  cd [path]     Change directory
  pwd           Print working directory
  cat <file>    Display file contents
  echo <text>   Print text
  whoami        Print current user
  hostname      Print hostname
  uname -a      Print system information
  uptime        Show system uptime
  df -h         Show disk usage
  free -h       Show memory usage
  docker ps     List running containers
  docker images List docker images
  neofetch      Show system info
  ping <host>   Ping a host
  ip addr       Show network interfaces
  date          Print current date
  clear         Clear the terminal
  history       Show command history`,
          },
        ],
        newCwd,
      }

    case "ls": {
      const target = args[0]
        ? args[0].startsWith("/") || args[0].startsWith("~")
          ? args[0]
          : `${cwd}/${args[0]}`
        : cwd
      const entries = virtualFS[target]
      if (entries) {
        const colored = entries
          .map((e) => {
            if (e.includes(".")) return e
            return `\x1b[1;34m${e}\x1b[0m`
          })
          .join("  ")
        return { output: [{ type: "output", content: colored }], newCwd }
      }
      return {
        output: [{ type: "error", content: `ls: cannot access '${target}': No such file or directory` }],
        newCwd,
      }
    }

    case "cd": {
      const target = args[0] || "~"
      if (target === "~" || target === "/home/admin") {
        return { output: [], newCwd: "~" }
      }
      if (target === "..") {
        const parent = cwd.includes("/") ? cwd.substring(0, cwd.lastIndexOf("/")) || "~" : "~"
        return { output: [], newCwd: parent }
      }
      const newPath = target.startsWith("~") || target.startsWith("/") ? target : `${cwd}/${target}`
      if (virtualFS[newPath]) {
        return { output: [], newCwd: newPath }
      }
      return {
        output: [{ type: "error", content: `cd: ${target}: No such file or directory` }],
        newCwd,
      }
    }

    case "pwd":
      return {
        output: [{ type: "output", content: cwd.replace("~", "/home/admin") }],
        newCwd,
      }

    case "cat": {
      const file = args[0]
      if (!file) return { output: [{ type: "error", content: "cat: missing operand" }], newCwd }
      const fileContents: Record<string, string> = {
        ".bashrc": `# ~/.bashrc\nexport PATH="$HOME/.local/bin:$PATH"\nexport EDITOR=vim\nalias ll='ls -la'\nalias dc='docker compose'\nalias dps='docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"'\n\n# Starship prompt\neval "$(starship init bash)"`,
        "notes.md": `# Server Lab Notes\n\n## TODO\n- [ ] Upgrade PostgreSQL to 16\n- [ ] Set up Wireguard VPN\n- [x] Configure automated backups\n- [x] Set up monitoring with Grafana`,
        "compose.yml": `version: "3.8"\nservices:\n  plex:\n    image: plexinc/pms-docker:latest\n    restart: unless-stopped\n    ports:\n      - "32400:32400"\n    volumes:\n      - ./data/plex:/config\n      - /mnt/media:/media\n\n  nextcloud:\n    image: nextcloud:latest\n    restart: unless-stopped\n    ports:\n      - "8080:80"\n    volumes:\n      - ./data/nextcloud:/var/www/html`,
        "backup.sh": `#!/bin/bash\n# ServerLab Backup Script\nset -euo pipefail\n\nBACKUP_DIR="/mnt/backups"\nDATE=$(date +%Y-%m-%d)\n\necho "Starting backup: $DATE"\n\n# Backup docker volumes\nfor vol in postgres redis nextcloud; do\n  docker run --rm -v ${vol}:/data -v $BACKUP_DIR:/backup \\\n    alpine tar czf /backup/${vol}-${DATE}.tar.gz /data\ndone\n\necho "Backup complete!"`,
        "config": `Host github\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/id_ed25519\n\nHost serverlab-remote\n  HostName 192.168.1.100\n  User admin\n  Port 22\n  ForwardAgent yes`,
      }
      const basename = file.split("/").pop() || file
      if (fileContents[basename]) {
        return { output: [{ type: "output", content: fileContents[basename] }], newCwd }
      }
      return { output: [{ type: "error", content: `cat: ${file}: No such file or directory` }], newCwd }
    }

    case "echo":
      return { output: [{ type: "output", content: args.join(" ") }], newCwd }

    case "whoami":
      return { output: [{ type: "output", content: USER }], newCwd }

    case "hostname":
      return { output: [{ type: "output", content: HOSTNAME }], newCwd }

    case "uname":
      return {
        output: [{ type: "output", content: "Linux serverlab 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64 GNU/Linux" }],
        newCwd,
      }

    case "uptime":
      return {
        output: [{ type: "output", content: " 14:32:07 up 47 days, 3:21,  2 users,  load average: 0.42, 0.38, 0.35" }],
        newCwd,
      }

    case "df":
      return {
        output: [{
          type: "output",
          content: `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       240G   42G  186G  19% /
/dev/sdb1       3.6T  1.8T  1.7T  52% /mnt/storage
/dev/sdc1       1.8T  920G  820G  53% /mnt/media
tmpfs           7.8G  1.2M  7.8G   1% /dev/shm`,
        }],
        newCwd,
      }

    case "free":
      return {
        output: [{
          type: "output",
          content: `              total        used        free      shared  buff/cache   available
Mem:           15Gi       4.2Gi       6.8Gi       312Mi       4.2Gi        10Gi
Swap:          8.0Gi          0B       8.0Gi`,
        }],
        newCwd,
      }

    case "docker":
      if (args[0] === "ps") {
        return {
          output: [{
            type: "output",
            content: `NAMES               STATUS              PORTS
plex                Up 47 days          0.0.0.0:32400->32400/tcp
nextcloud           Up 47 days          0.0.0.0:8080->80/tcp
pihole              Up 47 days          0.0.0.0:53->53/tcp, 0.0.0.0:8053->80/tcp
portainer           Up 47 days          0.0.0.0:9443->9443/tcp
grafana             Up 47 days          0.0.0.0:3000->3000/tcp
postgres            Up 47 days          0.0.0.0:5432->5432/tcp
home-assistant      Up 12 days          0.0.0.0:8123->8123/tcp
vaultwarden         Up 47 days          0.0.0.0:8222->80/tcp
nginx-proxy         Up 47 days          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
jellyfin            Up 47 days          0.0.0.0:8096->8096/tcp`,
          }],
          newCwd,
        }
      }
      if (args[0] === "images") {
        return {
          output: [{
            type: "output",
            content: `REPOSITORY               TAG       SIZE
plexinc/pms-docker       latest    348MB
nextcloud                latest    1.02GB
pihole/pihole            latest    289MB
portainer/portainer-ce   latest    297MB
grafana/grafana          latest    412MB
postgres                 16        432MB
homeassistant/home...    latest    1.84GB
vaultwarden/server       latest    242MB
jc21/nginx-proxy-m...    latest    183MB
jellyfin/jellyfin        latest    578MB`,
          }],
          newCwd,
        }
      }
      return {
        output: [{ type: "error", content: `docker: '${args[0] || ""}' is not a docker command.` }],
        newCwd,
      }

    case "neofetch":
      return {
        output: [{
          type: "info",
          content: `       _,met$$$$$gg.          admin@serverlab
    ,g$$$$$$$$$$$$$$$P.       ----------------
  ,g$$P"     """Y$$.".        OS: Debian GNU/Linux 12 (bookworm) x86_64
 ,$$P'              \`$$$.     Host: Custom Build
',$$P       ,ggs.     \`$$b:   Kernel: 6.1.0-18-amd64
\`d$$'     ,$P"'   .    $$$    Uptime: 47 days, 3 hours, 21 mins
 $$P      d$'     ,    $$P    Packages: 1247 (dpkg)
 $$:      $$.   -    ,d$$'    Shell: bash 5.2.15
 $$;      Y$b._   _,d$P'     Terminal: serverlab-term
 Y$$.    \`.'"Y$$$$P"'         CPU: AMD Ryzen 7 5700G (16) @ 3.8GHz
 \`$$b      "-.__              GPU: AMD Radeon Vega 8
  \`Y$$                        Memory: 4.2 GiB / 15.6 GiB
   \`Y$$.                      Disk: 2.76 TiB / 5.64 TiB
     \`$$b.                    Network: 192.168.1.100
       \`Y$$b.                 Docker: 24 containers (10 running)
          \`"Y$b._
              \`"""`,
        }],
        newCwd,
      }

    case "ping": {
      const host = args[0]
      if (!host) return { output: [{ type: "error", content: "ping: usage error: Destination address required" }], newCwd }
      return {
        output: [{
          type: "output",
          content: `PING ${host} (1.1.1.1) 56(84) bytes of data.
64 bytes from ${host}: icmp_seq=1 ttl=57 time=4.23 ms
64 bytes from ${host}: icmp_seq=2 ttl=57 time=3.89 ms
64 bytes from ${host}: icmp_seq=3 ttl=57 time=4.01 ms

--- ${host} ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2003ms`,
        }],
        newCwd,
      }
    }

    case "ip":
      if (args[0] === "addr" || args[0] === "a") {
        return {
          output: [{
            type: "output",
            content: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 192.168.1.100/24 brd 192.168.1.255 scope global enp3s0
3: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
4: wg0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1420
    inet 10.0.0.1/24 scope global wg0`,
          }],
          newCwd,
        }
      }
      return { output: [{ type: "error", content: `ip: command '${args[0]}' not recognized` }], newCwd }

    case "date":
      return {
        output: [{ type: "output", content: new Date().toString() }],
        newCwd,
      }

    case "history":
      return {
        output: [{
          type: "output",
          content: `    1  docker ps
    2  df -h
    3  docker compose pull
    4  docker compose up -d
    5  tail -f /var/log/syslog
    6  sudo apt update && sudo apt upgrade -y
    7  neofetch
    8  htop
    9  ls ~/docker
   10  cat ~/docker/compose.yml`,
        }],
        newCwd,
      }

    case "clear":
      return { output: [{ type: "info", content: "__CLEAR__" }], newCwd }

    case "exit":
      return { output: [{ type: "info", content: "logout" }], newCwd }

    default:
      return {
        output: [{ type: "error", content: `${cmd}: command not found. Type 'help' for available commands.` }],
        newCwd,
      }
  }
}

export function Terminal() {
  const [lines, setLines] = useState<TermLine[]>([
    {
      type: "welcome",
      content: `Welcome to ServerLab Terminal v2.1
Debian GNU/Linux 12 (bookworm) | Kernel 6.1.0-18-amd64
Last login: ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} from 192.168.1.42

Type 'help' for available commands.
`,
    },
  ])
  const [currentInput, setCurrentInput] = useState("")
  const [cwd, setCwd] = useState("~")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tabCount, setTabCount] = useState(1)
  const [activeTab, setActiveTab] = useState(0)

  // Auto-scroll and focus
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [lines])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = currentInput.trim()

    // Add input line
    const inputLine: TermLine = {
      type: "input",
      content: input,
      prompt: getPrompt(cwd),
    }

    if (input === "clear") {
      setLines([])
      setCurrentInput("")
      setCommandHistory((prev) => [...prev, input])
      setHistoryIndex(-1)
      return
    }

    const { output, newCwd } = simulateCommand(input, cwd)
    setCwd(newCwd)
    setLines((prev) => [...prev, inputLine, ...output])
    setCurrentInput("")
    if (input) {
      setCommandHistory((prev) => [...prev, input])
    }
    setHistoryIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setCurrentInput(commandHistory[newIndex])
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex === -1) return
      const newIndex = historyIndex + 1
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1)
        setCurrentInput("")
      } else {
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[newIndex])
      }
    } else if (e.key === "Tab") {
      e.preventDefault()
      // Simple tab completion for commands
      const cmds = ["help", "ls", "cd", "pwd", "cat", "echo", "whoami", "hostname", "uname", "uptime", "df", "free", "docker", "neofetch", "ping", "ip", "date", "clear", "history", "exit"]
      const match = cmds.filter((c) => c.startsWith(currentInput))
      if (match.length === 1) setCurrentInput(match[0] + " ")
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  return (
    <div className="flex h-full flex-col bg-card/90 select-text">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-0 border-b border-glass-border bg-popover/70">
        {Array.from({ length: tabCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex cursor-pointer items-center gap-2 border-r border-glass-border px-4 py-2 text-xs transition-colors ${
              activeTab === i
                ? "bg-card/75 text-foreground"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
          >
            <ChevronRight className="size-3" />
            <span className="font-mono">{USER}@{HOSTNAME}</span>
          </button>
        ))}
        <button
          onClick={() => { setTabCount((c) => c + 1); setActiveTab(tabCount); }}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="New tab"
        >
          +
        </button>
      </div>

      {/* Terminal output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-5 cursor-text"
        onClick={focusInput}
      >
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line.type === "welcome" && (
              <span className="text-primary/80">{line.content}</span>
            )}
            {line.type === "input" && (
              <div>
                <span className="text-status-green">{line.prompt}</span>{" "}
                <span className="text-foreground">{line.content}</span>
              </div>
            )}
            {line.type === "output" && (
              <span className="text-foreground/90">{line.content}</span>
            )}
            {line.type === "error" && (
              <span className="text-status-red">{line.content}</span>
            )}
            {line.type === "info" && line.content !== "__CLEAR__" && (
              <span className="text-primary/70">{line.content}</span>
            )}
          </div>
        ))}

        {/* Current input line */}
        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-status-green shrink-0">{getPrompt(cwd)}</span>
          <span>&nbsp;</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-foreground outline-none font-mono text-sm caret-primary"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
        </form>
      </div>

      {/* Bottom info bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-glass-border bg-popover/70 px-4 py-1.5 font-mono text-xs text-muted-foreground">
        <span>bash 5.2.15</span>
        <span>{cwd.replace("~", "/home/admin")}</span>
        <span>{commandHistory.length} commands</span>
      </div>
    </div>
  )
}
