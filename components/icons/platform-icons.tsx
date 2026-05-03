import type { SVGProps } from "react";

export type { LucideIcon } from "lucide-react";

export {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpCircle,
  BarChart3,
  BatteryCharging,
  BatteryFull,
  Bell,
  BookOpen,
  CalendarClock,
  Camera,
  Check,
  Check         as CheckIcon,
  CheckCircle2,
  ChevronDown   as ChevronDownIcon,
  ChevronLeft   as ChevronLeftIcon,
  ChevronRight,
  ChevronRight  as ChevronRightIcon,
  ChevronUp     as ChevronUpIcon,
  Circle        as CircleIcon,
  ClipboardPaste,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Code,
  Container,
  Copy,
  Cpu,
  Database,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileText,
  FileVideo,
  Film,
  Folder,
  FolderOpen,
  Gamepad2,
  Gauge,
  Globe,
  GripVertical  as GripVerticalIcon,
  HardDrive,
  Home,
  Info,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Loader2       as Loader2Icon,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  Maximize2,
  MemoryStick,
  MessageSquare,
  Minimize2,
  Minus,
  Minus         as MinusIcon,
  MonitorSpeaker,
  MoreHorizontal,
  MoreHorizontal as MoreHorizontalIcon,
  Music,
  Network,
  Package,
  Paintbrush,
  PanelLeft     as PanelLeftIcon,
  Pause,
  Play,
  Plug,
  PlugZap,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Router,
  Rss,
  Save,
  Scissors,
  ScrollText,
  Search,
  Search        as SearchIcon,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  ShoppingBag,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SortAsc,
  SortDesc,
  Sparkles,
  Square,
  Star,
  Sun,
  TerminalSquare,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  Usb,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  Wind,
  Wrench,
  X,
  X             as XIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// Filled star — lucide Star is outline-only
export function StarFilled({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

// Eject icon (not in lucide-react)
export function EjectIcon({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12l7-9 7 9H5z" />
      <rect x="5" y="15" width="14" height="3" rx="1" />
    </svg>
  );
}
