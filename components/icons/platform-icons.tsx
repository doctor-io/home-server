import type { CSSProperties, ImgHTMLAttributes, ReactElement, SVGProps } from "react";

type KoraIconProps = SVGProps<SVGSVGElement> & {
  alt?: string;
  size?: number | string;
};

export type LucideIcon = (props: KoraIconProps) => ReactElement;

function sizeValue(size: number | string | undefined) {
  return typeof size === "number" ? `${size}px` : size;
}

function createKoraIcon(src: string, alt = ""): LucideIcon {
  const Icon = ({
    className,
    style,
    size,
    color: _color,
    strokeWidth: _strokeWidth,
    alt: iconAlt = alt,
    ...props
  }: KoraIconProps) => {
    const inlineSize = sizeValue(size);
    const iconStyle: CSSProperties | undefined = inlineSize
      ? { width: inlineSize, height: inlineSize, ...style }
      : style;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={iconAlt}
        aria-hidden={iconAlt ? undefined : true}
        draggable={false}
        className={className}
        style={iconStyle}
        {...(props as unknown as ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  };
  Icon.displayName = `KoraIcon(${src.split("/").pop() ?? "icon"})`;
  return Icon;
}

const ACTION = "/kora/actions/16";
const APPS = "/kora/apps/scalable";
const DEVICES = "/kora/devices/scalable";
const MIME = "/kora/mimetypes/scalable";
const PLACES = "/kora/places/scalable";
const STATUS = "/kora/status/scalable";

export const Activity = createKoraIcon(`${ACTION}/view-statistics.svg`);
export const AlertCircle = createKoraIcon(`${STATUS}/dialog-information.svg`);
export const AlertTriangle = createKoraIcon(`${STATUS}/dialog-warning.svg`);
export const ArrowDown = createKoraIcon(`${ACTION}/go-down.svg`);
export const ArrowLeft = createKoraIcon(`${ACTION}/go-previous.svg`);
export const ArrowRight = createKoraIcon(`${ACTION}/go-next.svg`);
export const ArrowUp = createKoraIcon(`${ACTION}/go-up.svg`);
export const ArrowUpCircle = createKoraIcon(`${ACTION}/system-upgrade.svg`);
export const BarChart3 = createKoraIcon(`${ACTION}/view-statistics.svg`);
export const BatteryCharging = createKoraIcon(`${STATUS}/battery-full-charging.svg`);
export const BatteryFull = createKoraIcon(`${STATUS}/battery-full.svg`);
export const Bell = createKoraIcon(`${ACTION}/bell.svg`);
export const BookOpen = createKoraIcon(`${ACTION}/help-contents.svg`);
export const CalendarClock = createKoraIcon(`${ACTION}/chronometer.svg`);
export const Camera = createKoraIcon(`${DEVICES}/camera-photo.svg`);
export const Check = createKoraIcon(`${ACTION}/dialog-ok.svg`);
export const CheckIcon = Check;
export const CheckCircle2 = createKoraIcon(`${ACTION}/dialog-ok-apply.svg`);
export const ChevronDownIcon = createKoraIcon(`${ACTION}/go-down.svg`);
export const ChevronLeftIcon = createKoraIcon(`${ACTION}/go-previous.svg`);
export const ChevronRight = createKoraIcon(`${ACTION}/go-next.svg`);
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = createKoraIcon(`${ACTION}/go-up.svg`);
export const CircleIcon = createKoraIcon(`${ACTION}/draw-circle.svg`);
export const ClipboardPaste = createKoraIcon(`${ACTION}/edit-paste.svg`);
export const Clock = createKoraIcon(`${ACTION}/clock.svg`);
export const Cloud = createKoraIcon(`${PLACES}/folder-cloud.svg`);
export const CloudDrizzle = createKoraIcon(`${STATUS}/weather-showers-scattered.svg`);
export const CloudFog = createKoraIcon(`${STATUS}/weather-fog.svg`);
export const CloudLightning = createKoraIcon(`${STATUS}/weather-storm.svg`);
export const CloudRain = createKoraIcon(`${STATUS}/weather-showers.svg`);
export const CloudSnow = createKoraIcon(`${STATUS}/weather-snow.svg`);
export const CloudSun = createKoraIcon(`${STATUS}/weather-few-clouds.svg`);
export const Code = createKoraIcon(`${ACTION}/code-block.svg`);
export const Container = createKoraIcon(`${APPS}/docker-desktop.svg`);
export const Copy = createKoraIcon(`${ACTION}/edit-copy.svg`);
export const Cpu = createKoraIcon(`${DEVICES}/cpu.svg`);
export const Database = createKoraIcon(`${DEVICES}/server-database.svg`);
export const Download = createKoraIcon(`${ACTION}/download.svg`);
export const Droplets = createKoraIcon(`${STATUS}/weather-showers.svg`);
export const ExternalLink = createKoraIcon(`${ACTION}/window-new.svg`);
export const Eye = createKoraIcon(`${ACTION}/view-visible.svg`);
export const EyeOff = createKoraIcon(`${ACTION}/view-hidden.svg`);
export const File = createKoraIcon(`${ACTION}/document-new.svg`);
export const FileArchive = createKoraIcon(`${ACTION}/archive.svg`);
export const FileCode = createKoraIcon(`${ACTION}/code-block.svg`);
export const FileCog = createKoraIcon(`${ACTION}/document-properties.svg`);
export const FileImage = createKoraIcon(`${ACTION}/insert-image.svg`);
export const FileText = createKoraIcon(`${MIME}/text-x-generic.svg`);
export const FileVideo = createKoraIcon(`${ACTION}/view-list-video.svg`);
export const Film = createKoraIcon(`${MIME}/video-x-generic.svg`);
export const Folder = createKoraIcon(`${PLACES}/folder.svg`);
export const FolderOpen = createKoraIcon(`${PLACES}/folder-open.svg`);
export const Gamepad2 = createKoraIcon(`${DEVICES}/input-gaming.svg`);
export const Gauge = createKoraIcon(`${ACTION}/view-statistics.svg`);
export const Globe = createKoraIcon(`${ACTION}/web-browser.svg`);
export const GripVerticalIcon = createKoraIcon(`${ACTION}/view-list-details.svg`);
export const HardDrive = createKoraIcon(`${DEVICES}/drive-harddisk.svg`);
export const Home = createKoraIcon(`${ACTION}/homerun.svg`);
export const Info = createKoraIcon(`${ACTION}/dialog-information.svg`);
export const LayoutGrid = createKoraIcon(`${ACTION}/view-grid.svg`);
export const Link2 = createKoraIcon(`${ACTION}/insert-link.svg`);
export const List = createKoraIcon(`${ACTION}/view-list.svg`);
export const Loader2 = createKoraIcon(`${ACTION}/view-refresh.svg`);
export const Loader2Icon = Loader2;
export const Lock = createKoraIcon(`${ACTION}/lock.svg`);
export const LockKeyhole = createKoraIcon(`${ACTION}/dialog-password.svg`);
export const LogOut = createKoraIcon(`${ACTION}/system-log-out.svg`);
export const Mail = createKoraIcon(`${ACTION}/mail-message-new.svg`);
export const Maximize2 = createKoraIcon(`${ACTION}/window-maximize.svg`);
export const MemoryStick = createKoraIcon(`${DEVICES}/memory.svg`);
export const MessageSquare = createKoraIcon(`${ACTION}/dialog-messages.svg`);
export const Minimize2 = createKoraIcon(`${ACTION}/window-minimize.svg`);
export const Minus = createKoraIcon(`${ACTION}/list-remove.svg`);
export const MinusIcon = Minus;
export const MonitorSpeaker = createKoraIcon(`${DEVICES}/video-display.svg`);
export const MoreHorizontal = createKoraIcon(`${ACTION}/view-more-horizontal.svg`);
export const MoreHorizontalIcon = MoreHorizontal;
export const Music = createKoraIcon(`${ACTION}/view-media-track.svg`);
export const Network = createKoraIcon(`${DEVICES}/network-wired.svg`);
export const Package = createKoraIcon(`${ACTION}/package.svg`);
export const Paintbrush = createKoraIcon(`${ACTION}/draw-brush.svg`);
export const PanelLeftIcon = createKoraIcon(`${ACTION}/view-left-close.svg`);
export const Pause = createKoraIcon(`${ACTION}/media-playback-pause.svg`);
export const Play = createKoraIcon(`${ACTION}/media-playback-start.svg`);
export const Plug = createKoraIcon(`${STATUS}/ac-adapter.svg`);
export const PlugZap = createKoraIcon(`${STATUS}/battery-ac-adapter.svg`);
export const Plus = createKoraIcon(`${ACTION}/list-add.svg`);
export const Power = createKoraIcon(`${ACTION}/system-shutdown.svg`);
export const RefreshCw = createKoraIcon(`${ACTION}/view-refresh.svg`);
export const RotateCcw = createKoraIcon(`${ACTION}/edit-undo.svg`);
export const RotateCw = createKoraIcon(`${ACTION}/edit-redo.svg`);
export const Router = createKoraIcon(`${DEVICES}/network-wireless.svg`);
export const Rss = createKoraIcon(`${ACTION}/application-rss+xml.svg`);
export const Save = createKoraIcon(`${ACTION}/document-save.svg`);
export const Scissors = createKoraIcon(`${ACTION}/edit-cut.svg`);
export const ScrollText = createKoraIcon(`${ACTION}/view-list-text.svg`);
export const Search = createKoraIcon(`${ACTION}/system-search.svg`);
export const SearchIcon = Search;
export const Server = createKoraIcon(`${DEVICES}/network-server.svg`);
export const Settings = createKoraIcon(`${ACTION}/configure.svg`);
export const Settings2 = createKoraIcon(`${ACTION}/configure-toolbars.svg`);
export const Shield = createKoraIcon(`${ACTION}/view-certificate.svg`);
export const ShieldAlert = createKoraIcon(`${STATUS}/dialog-warning.svg`);
export const ShoppingBag = createKoraIcon(`${ACTION}/system-software-install.svg`);
export const SignalHigh = createKoraIcon(`${STATUS}/notification-network-wireless.svg`);
export const SignalLow = createKoraIcon(`${STATUS}/notification-network-wireless-disconnected.svg`);
export const SignalMedium = createKoraIcon(`${STATUS}/notification-network-wireless-symbolic.svg`);
export const SortAsc = createKoraIcon(`${ACTION}/view-sort-ascending.svg`);
export const SortDesc = createKoraIcon(`${ACTION}/view-sort-descending.svg`);
export const Sparkles = createKoraIcon(`${ACTION}/favorite.svg`);
export const Square = createKoraIcon(`${ACTION}/draw-rectangle.svg`);
export const Star = createKoraIcon(`${ACTION}/star-on.svg`);
export const StarFilled = Star;
export const Sun = createKoraIcon(`${STATUS}/weather-clear.svg`);
export const TerminalSquare = createKoraIcon(`${APPS}/org.gnome.Terminal.svg`);
export const Thermometer = createKoraIcon(`${STATUS}/weather-clear-wind.svg`);
export const Tailscale = createKoraIcon(`${DEVICES}/network-vpn.svg`);
export const ToggleLeft = createKoraIcon(`${ACTION}/checkbox.svg`);
export const ToggleRight = createKoraIcon(`${ACTION}/checked-completed.svg`);
export const Trash2 = createKoraIcon(`${ACTION}/edit-delete.svg`);
export const Upload = createKoraIcon(`${ACTION}/upload.svg`);
export const Usb = createKoraIcon(`${DEVICES}/drive-removable-media-usb.svg`);
export const UserRound = createKoraIcon(`${ACTION}/user.svg`);
export const Users = createKoraIcon(`${ACTION}/system-users.svg`);
export const Wifi = createKoraIcon(`${STATUS}/notification-network-wireless.svg`);
export const WifiOff = createKoraIcon(`${ACTION}/network-disconnect.svg`);
export const Wind = createKoraIcon(`${STATUS}/weather-clear-wind.svg`);
export const Wrench = createKoraIcon(`${ACTION}/tools.svg`);
export const X = createKoraIcon(`${ACTION}/dialog-close.svg`);
export const XIcon = X;
export const ZoomIn = createKoraIcon(`${ACTION}/zoom-in.svg`);
export const ZoomOut = createKoraIcon(`${ACTION}/zoom-out.svg`);
export const EjectIcon = createKoraIcon(`${ACTION}/media-eject.svg`);
