export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    copy: "M9 9h12v12H9zM5 15H3V3h12v2",
    key: "M15.5 14a5.5 5.5 0 1 0-5.3-4L3 17v4h4v-3h3l2.2-2.2M16 7h.01",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    "eye-off":
      "m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3.1 4M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8M10 10a3 3 0 0 0 4 4",
    logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2-5h4l.7 2.3 2 .9 2.3-.6 2 3.4-1.6 1.7v2.6L21 15l-2 3.4-2.3-.6-2 .9L14 21h-4l-.7-2.3-2-.9-2.3.6L3 15l1.6-1.7v-2.6L3 9l2-3.4 2.3.6 2-.9L10 3Z",
    minus: "M6 12h12",
    user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    edit: "m15 5 4 4M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z",
    plus: "M12 5v14M5 12h14",
    chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z",
    folder: "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8M8 17h5",
    shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm0 5v5m0 3h.01",
    tasks: "m3 6 2 2 4-4m-6 9 2 2 4-4m-6 9 2 2 4-4M12 6h9M12 13h9M12 20h9",
    sidebar: "M3 4h18v16H3V4Zm6 0v16",
    open: "M14 3h7v7m0-7L10 14M11 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7",
    panel: "M3 4h18v16H3V4Zm12 0v16",
    menu: "M4 6h16M4 12h16M4 18h16",
    chevron: "m8 10 4 4 4-4",
    arrow: "M12 19V5m-6 6 6-6 6 6",
    right: "M5 12h14m-6-6 6 6-6 6",
    close: "m6 6 12 12M6 18 18 6",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    download: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
    attach: "m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8",
    play: "m8 5 11 7-11 7V5Z",
    agent:
      "M6 8v8m0-4h8a4 4 0 0 0 4-4M4 4h4v4H4V4Zm0 12h4v4H4v-4Zm12-12h4v4h-4V4Z",
    brand: "M4 4h9v9H4V4Zm7 11v5h9v-9h-5M8 8l8 8m-5 0h5v-5",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    refresh:
      "M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9",
    info: "M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
