self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const scorexpClient = clients.find((client) => "focus" in client);
      if (scorexpClient) return scorexpClient.focus();
      if (self.clients.openWindow) return self.clients.openWindow("/");
      return undefined;
    })
  );
});
