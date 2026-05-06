import type { ReactNode, SVGProps } from "react";

export type AppIconProps = SVGProps<SVGSVGElement> & { size?: 16 | 18 | 20 | 24 | number };

const defaultIconProps: AppIconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.75
};

function AppIcon({
  children,
  size = 20,
  ...props
}: AppIconProps & { children: ReactNode }) {
  return (
    <svg
      {...defaultIconProps}
      {...props}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function path(d: string, props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <path d={d} />
    </AppIcon>
  );
}

export function IconHome(props: AppIconProps) {
  return path("M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z M9 21v-7h6v7", props);
}

export function IconReview(props: AppIconProps) {
  return path("M5 7h11a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z M7 4h10a2 2 0 0 1 2 2v2 M8 12h6 M8 16h4", props);
}

export function IconDeck(props: AppIconProps) {
  return path("M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12.5A1.5 1.5 0 0 1 18.5 20H6.5A2.5 2.5 0 0 1 4 17.5v-11Z M7 8h9 M7 12h7 M7 16h5", props);
}

export function IconQuiz(props: AppIconProps) {
  return path("M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z M9 14l2 2 4-4", props);
}

export function IconBattle(props: AppIconProps) {
  return path("M13 2 4 14h7l-1 8 10-12h-7l0-8Z", props);
}

export function IconAnalytics(props: AppIconProps) {
  return path("M5 20V11 M12 20V4 M19 20v-7 M3 20h18", props);
}

export function IconSearch(props: AppIconProps) {
  return path("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M20 20l-4.1-4.1", props);
}

export function IconBookmark(props: AppIconProps) {
  return path("M6 4h12a2 2 0 0 1 2 2v14l-8-4-8 4V6a2 2 0 0 1 2-2Z", props);
}

export function IconSettings(props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.2 15a1.7 1.7 0 0 0 .34 1.87l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 14.85 19a1.7 1.7 0 0 0-1.05 1.57V21a2 2 0 0 1-4 0v-.43A1.7 1.7 0 0 0 8.75 19a1.7 1.7 0 0 0-1.86.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.4 15 1.7 1.7 0 0 0 2.83 14H2.5a2 2 0 0 1 0-4h.33A1.7 1.7 0 0 0 4.4 9a1.7 1.7 0 0 0-.34-1.87l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 8.75 5a1.7 1.7 0 0 0 1.05-1.57V3a2 2 0 0 1 4 0v.43A1.7 1.7 0 0 0 14.85 5a1.7 1.7 0 0 0 1.86-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.2 9a1.7 1.7 0 0 0 1.57 1H21.5a2 2 0 0 1 0 4h-.73A1.7 1.7 0 0 0 19.2 15Z" />
    </AppIcon>
  );
}

export function IconAccount(props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <path d="M19 20a7 7 0 0 0-14 0" />
      <circle cx="12" cy="8" r="4" />
    </AppIcon>
  );
}

export const IconUser = IconAccount;

export function IconLogout(props: AppIconProps) {
  return path("M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4 M15 16l4-4-4-4 M19 12H9", props);
}

export function IconNotice(props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <path d="M5 9.5v5A2.5 2.5 0 0 0 7.5 17H9l3 3v-3h4.5A2.5 2.5 0 0 0 19 14.5v-5A2.5 2.5 0 0 0 16.5 7h-9A2.5 2.5 0 0 0 5 9.5Z" />
      <path d="M9 11h6 M9 14h3" />
    </AppIcon>
  );
}

export function IconClock(props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </AppIcon>
  );
}

export function IconClose(props: AppIconProps) {
  return path("M18 6 6 18M6 6l12 12", props);
}

export function IconHelp(props: AppIconProps) {
  return (
    <AppIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.8 9.5a2.4 2.4 0 1 1 3.6 2.1c-.85.5-1.4 1.05-1.4 2.15 M12 17h.01" />
    </AppIcon>
  );
}

export function IconShield(props: AppIconProps) {
  return path("M12 3 5 6v5.5c0 4.1 2.7 7.6 7 9.5 4.3-1.9 7-5.4 7-9.5V6l-7-3Z", props);
}

export function IconDocument(props: AppIconProps) {
  return path("M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M14 3v5h5 M9 13h6 M9 17h4", props);
}

export function IconMessage(props: AppIconProps) {
  return path("M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-5 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6Z", props);
}

export function IconSpark(props: AppIconProps) {
  return path("M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z", props);
}

export function IconMore(props: AppIconProps) {
  return (
    <AppIcon {...props} fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </AppIcon>
  );
}
