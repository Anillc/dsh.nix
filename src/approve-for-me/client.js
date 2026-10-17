window.__ModuleLoader__.load({
  id: "@local/approve-for-me",
  factory(requireModule) {
    const React = requireModule("react");
    const h = React.createElement;
    const NS = "approve-for-me";
    const zh = {
      "badge": "AI 已放行",
      "aria": "自动审核的提权操作",
      "title": "提权操作经 AI 审核后自动放行",
      "toggle.label": "Approve for me",
      "toggle.aria": "Approve for me：提权请求先由 AI 审核（仅当前会话）",
      "toggle.on": "Approve for me 已开启：提权请求先交给 AI 审核，不通过时再询问你",
      "toggle.off": "Approve for me 已关闭：提权请求直接询问你"
    };
    const en = {
      "badge": "AI approved",
      "aria": "Auto-approved escalation",
      "title": "Escalation approved by AI review without asking the user",
      "toggle.label": "Approve for me",
      "toggle.aria": "Approve for me: review escalation requests with AI first (this session only)",
      "toggle.on": "Approve for me is on: escalations go to AI review first, then to you if denied",
      "toggle.off": "Approve for me is off: escalations ask you directly"
    };
    const row = {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      minWidth: 0,
      padding: "0 2px",
      color: "var(--dsw-alias-label-secondary)",
      fontSize: "12px",
      lineHeight: "18px"
    };
    const badge = {
      flex: "none",
      padding: "0 6px",
      border: "0.5px solid var(--dsw-alias-border-l1)",
      borderRadius: "4px",
      background: "var(--dsw-alias-bg-layer-2)",
      color: "var(--dsw-alias-state-success-primary)",
      fontSize: "11px",
      lineHeight: "16px"
    };
    const text = {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    };
    const toggleButton = {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "24px",
      padding: "0 8px",
      border: "0.5px solid var(--dsw-alias-border-l1)",
      borderRadius: "6px",
      background: "var(--dsw-alias-bg-layer-1)",
      color: "var(--dsw-alias-label-secondary)",
      fontSize: "12px",
      lineHeight: "16px",
      cursor: "pointer"
    };
    const toggleButtonOn = {
      ...toggleButton,
      color: "var(--dsw-alias-label-primary)"
    };
    const checkboxBox = {
      width: "12px",
      height: "12px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid var(--dsw-alias-border-l2)",
      borderRadius: "3px",
      fontSize: "10px",
      lineHeight: "10px",
      flex: "none"
    };
    const checkboxBoxOn = {
      ...checkboxBox,
      borderColor: "var(--dsw-alias-brand-primary)",
      background: "var(--dsw-alias-brand-primary)",
      color: "var(--dsw-alias-bg-base)"
    };
    const definition = {
      kind: "approval-auto",
      target: "chat",
      match(event) {
        if (event.type === "approval/asked") return { id: String(event.data.id), role: "start" };
        if (event.type === "approval/decided") return { id: String(event.data.id), role: "update" };
        return null;
      },
      start(_context, match) {
        const event = match.event;
        if (event.type !== "approval/asked") throw new Error("approval-auto: start requires approval/asked");
        const data = event.data;
        return {
          toolName: data.toolName,
          callId: data.callId,
          reason: data.displayReason === void 0 ? data.reason : data.displayReason.en,
          seq: event.seq,
          time: event.time,
          outcome: void 0
        };
      },
      update(context, match) {
        const event = match.event;
        if (event.type !== "approval/decided" || context.state === void 0) return context.state;
        const data = event.data;
        return { ...context.state, outcome: data.outcome };
      },
      buildViewNode(context) {
        const state = context.state;
        const start = context.start ?? context.matches[0];
        if (state === void 0 || start === void 0 || state.outcome !== "allowed-once") return null;
        if (state.callId === void 0) return null;
        return {
          key: context.key,
          kind: "approval-auto",
          id: context.id,
          target: "chat",
          anchorSeq: start.event.seq,
          location: start.location,
          visibility: "visible",
          data: {
            toolName: state.toolName,
            callId: state.callId,
            reason: state.reason,
            time: state.time
          }
        };
      }
    };
    function ApprovalAutoRow({ node, t, useProjection }) {
      const projection = useProjection("approveForMe");
      const entry = projection === void 0 || projection === null ? void 0 : projection.calls[node.data.callId];
      if (entry === void 0) return null;
      const reason = node.data.reason;
      const detail = reason === void 0 || reason === "" ? node.data.toolName : `${node.data.toolName} · ${reason}`;
      const title = entry.rationale === void 0 ? `${t("title")} (${entry.risk})` : `${t("title")} (${entry.risk}) — ${entry.rationale}`;
      return h(
        "div",
        {
          role: "note",
          "aria-label": t("aria"),
          "data-approval-auto": node.data.callId ?? node.id,
          style: row
        },
        h("span", { style: badge }, t("badge")),
        h("span", { style: text, title }, detail)
      );
    }
    function ApprovalToggle({ t, useProjection, toggle }) {
      const projection = useProjection("approveForMe");
      const enabled = projection !== void 0 && projection !== null && projection.enabled === true;
      return h("button", {
        type: "button",
        role: "switch",
        "aria-checked": enabled,
        "aria-label": t("toggle.aria"),
        title: enabled ? t("toggle.on") : t("toggle.off"),
        style: enabled ? toggleButtonOn : toggleButton,
        onClick: () => {
          Promise.resolve(toggle(!enabled)).catch(() => {});
        }
      },
      h("span", { "aria-hidden": true, style: enabled ? checkboxBoxOn : checkboxBox }, enabled ? "✓" : ""),
      h("span", null, t("toggle.label")));
    }
    return {
      inject: ["slots", "locale", "uiConversation", "sessions"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "approve-for-me: dictionaries");
        ctx.effect(() => ctx.uiConversation.events.register(definition), "approve-for-me: definition");
        ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
          name: "conversation.chat.node",
          key: "approval-auto",
          locale: NS
        }, ApprovalAutoRow));
        ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
          name: "conversation.input.left",
          id: "approve-for-me",
          order: 20,
          locale: NS,
          inject: (sessionId) => ({
            toggle: async (on) => {
              const session = ctx.sessions.binding(sessionId)?.session;
              if (session === void 0) return;
              await session.command(`/approve-for-me ${on ? "on" : "off"}`);
            }
          })
        }, ApprovalToggle));
      }
    };
  }
});
