self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => "focus" in client);
    const target = event.notification.data?.url || "/";
    return existing ? existing.focus().then((client) => client.navigate?.(target) || client) : clients.openWindow(target);
  }));
});
