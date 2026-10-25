window.__ModuleLoader__.load({id:"dsh-btw",factory:(require)=>{
const module={exports:{}};const exports=module.exports;

const reactModule = require("react");
const React = reactModule && reactModule.default ? reactModule.default : reactModule;
const h = React.createElement;
const useSyncExternalStore = React.useSyncExternalStore;
const ReactDOM = require("react-dom");

const STORAGE_PREFIX = "dsh-btw:";
const COPY_FEEDBACK_MS = 1200;

const CSS = `
.btw-portal{padding:8px calc(var(--dsh-composer-side-clearance,0px) + 16px) 12px;box-sizing:border-box}
.btw-dock{display:flex;flex-direction:column;width:100%;max-width:var(--dsh-chat-content-width,100%);margin:0 auto;padding:0;box-sizing:border-box;letter-spacing:0}
.btw-bubbles{display:flex;flex-direction:column;gap:8px;padding:0 0 8px}
.btw-bubble{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;min-width:0;flex:none;font-size:13px;line-height:1.6;font-family:var(--dsw-font-family,inherit);letter-spacing:0;overflow:hidden}
.btw-header{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;min-width:0;min-height:44px}
.btw-symbol{display:flex;align-items:center;color:var(--dsw-alias-label-secondary);height:28px;flex-shrink:0}
.btw-question{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:500;line-height:22px}
.btw-count{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap;flex:none}
.btw-actions{display:flex;gap:4px;flex-shrink:0}
.btw-actions button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease}
.btw-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.btw-actions button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,var(--dsw-alias-label-primary));outline-offset:-2px}
.btw-thread{display:flex;flex-direction:column;gap:10px;padding:0 14px 10px}
.btw-turn{display:flex;flex-direction:column;gap:6px;min-width:0}
.btw-turn-q{align-self:flex-end;max-width:88%;background:var(--dsw-alias-interactive-bg-hover);border-radius:10px;padding:6px 9px;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.btw-answer{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.7}
.btw-code{margin:8px 0;padding:10px;border-radius:8px;background:var(--dsw-alias-markdown-code-block,#f3f3f3);overflow:auto;font-size:12px;line-height:1.5;font-family:Consolas,monospace;white-space:pre}
.btw-code:first-child{margin-top:0}.btw-code:last-child{margin-bottom:0}
.btw-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px}
.btw-spinner{width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-label-secondary);border-radius:50%;animation:btw-spin 1s linear infinite;display:inline-block;box-sizing:border-box;flex:none}
@keyframes btw-spin{to{transform:rotate(360deg)}}
.btw-error{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));overflow-wrap:anywhere;white-space:pre-wrap}
.btw-compose{display:flex;align-items:flex-end;gap:8px;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l1)}
.btw-input{flex:1;min-height:36px;resize:none;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:13px;line-height:1.5;outline:none}
.btw-input:focus{border-color:var(--dsw-alias-state-business-primary,var(--dsw-alias-border-l3))}
.btw-input:disabled{opacity:.6}
.btw-send{display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:var(--dsw-alias-state-business-primary,#2f6feb);color:#fff;cursor:pointer;flex:none}
.btw-send:disabled{opacity:.4;cursor:default}
@media(max-width:480px){.btw-header{padding:6px 8px 6px 12px;gap:6px}.btw-thread{padding:0 12px 8px}.btw-actions{gap:0}.btw-actions button{width:36px;height:36px}}
@media(prefers-reduced-motion:reduce){.btw-spinner{animation:none}.btw-actions button{transition:none}}
`;

function Svg({ children, size = 14 }) {
  return h("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, children);
}
function MessageIcon({ size = 15 }) {
  return h(Svg, { size }, h("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" }));
}
function CopyIcon() {
  return h(Svg, null, h("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }), h("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }));
}
function CheckIcon() {
  return h(Svg, null, h("path", { d: "M20 6 9 17l-5-5" }));
}
function ChevronDownIcon() {
  return h(Svg, null, h("path", { d: "m6 9 6 6 6-6" }));
}
function ChevronUpIcon() {
  return h(Svg, null, h("path", { d: "m18 15-6-6-6 6" }));
}
function XIcon() {
  return h(Svg, null, h("path", { d: "M18 6 6 18M6 6l12 12" }));
}
function SendIcon() {
  return h(Svg, null, h("path", { d: "M12 19V5" }), h("path", { d: "m5 12 7-7 7 7" }));
}

function sessionIdOf(session) {
  if (typeof session === "string") return session;
  if (session && typeof session === "object" && session.sessionId !== undefined) return String(session.sessionId);
  return String(session);
}

function loadState(sessionId) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + sessionId) || "null");
    const boxes = Array.isArray(parsed && parsed.boxes) ? parsed.boxes : [];
    return { boxes: boxes.map(function (box) {
      return Object.assign({}, box, {
        autoFocus: false,
        turns: box.turns.map(function (turn) {
          return Object.assign({}, turn, { status: turn.error ? "error" : "done" });
        })
      });
    }).filter(function (box) { return box.turns.length > 0 }) };
  } catch (_error) {
    return { boxes: [] };
  }
}

function saveState(sessionId, boxes) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify({
      boxes: boxes.map(function (box) {
        return Object.assign({}, box, {
          turns: box.turns.filter(function (turn) { return turn.status !== "pending" })
        });
      }).filter(function (box) { return box.turns.length > 0 })
    }));
  } catch (_error) {}
}

function newBoxId() {
  return "b-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function newTurnId() {
  return "q-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function newThreadId() {
  return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

let remoteRef;
const stores = new Map();

function createStore(sessionId, remote) {
  const saved = loadState(sessionId);
  let boxes = saved.boxes;
  const listeners = new Set();
  const controllers = new Map();
  const emit = function (next) {
    boxes = next;
    saveState(sessionId, boxes);
    for (const listener of [...listeners]) listener();
  };
  const closeThread = function (threadId) {
    remote.commands.execute(sessionId, "/btw-close " + threadId, [], new AbortController().signal).catch(function () {});
  };
  const patchTurn = function (boxId, turnId, value) {
    const box = boxes.find(function (entry) { return entry.id === boxId; });
    if (!box) return;
    const turns = box.turns.map(function (turn) { return turn.id === turnId ? Object.assign({}, turn, value) : turn; });
    emit(boxes.map(function (entry) { return entry.id === boxId ? Object.assign({}, entry, { turns: turns }) : entry; }));
  };
  const run = function (box, turn, controller) {
    const line = "/btw-run " + JSON.stringify({ threadId: box.threadId, question: turn.question });
    remote.commands.execute(sessionId, line, [], controller.signal).then(function (response) {
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(response.error && response.error.message ? response.error.message : "btw 失败");
      if (!response.value) throw new Error("btw 后端不可用");
      const result = response.value.result;
      if (!result || result.kind !== "success") throw new Error(result && result.text ? result.text : "btw 失败");
      const answer = String(result.text || "").trim();
      if (!answer) throw new Error("模型没有返回文字");
      patchTurn(box.id, turn.id, { answer: answer, status: "done", error: "" });
    }).catch(function (error) {
      if (controller.signal.aborted) return;
      patchTurn(box.id, turn.id, { status: "error", error: error instanceof Error ? error.message : String(error) });
    }).finally(function () {
      if (controllers.get(box.id) === controller) controllers.delete(box.id);
    });
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener) };
    },
    getSnapshot() {
      return boxes;
    },
    createBox(question) {
      const box = {
        id: newBoxId(),
        threadId: newThreadId(),
        collapsed: false,
        autoFocus: true,
        turns: [{ id: newTurnId(), question: question, answer: "", error: "", status: "pending" }]
      };
      const next = boxes.map(function (entry) { return Object.assign({}, entry, { autoFocus: false }) });
      next.push(box);
      emit(next);
      const controller = new AbortController();
      controllers.set(box.id, controller);
      run(box, box.turns[0], controller);
    },
    askInBox(boxId, question) {
      const box = boxes.find(function (entry) { return entry.id === boxId; });
      if (!box || box.turns.some(function (turn) { return turn.status === "pending"; })) return;
      const turn = { id: newTurnId(), question: question, answer: "", error: "", status: "pending" };
      emit(boxes.map(function (entry) { return entry.id === boxId ? Object.assign({}, entry, { turns: entry.turns.concat([turn]) }) : entry; }));
      const controller = new AbortController();
      controllers.set(boxId, controller);
      run(box, turn, controller);
    },
    closeBox(boxId) {
      const controller = controllers.get(boxId);
      if (controller) controller.abort();
      controllers.delete(boxId);
      const box = boxes.find(function (entry) { return entry.id === boxId; });
      emit(boxes.filter(function (entry) { return entry.id !== boxId; }));
      if (box) closeThread(box.threadId);
    },
    toggleBox(boxId) {
      emit(boxes.map(function (entry) { return entry.id === boxId ? Object.assign({}, entry, { collapsed: !entry.collapsed }) : entry; }));
    },
    dispose() {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      listeners.clear();
    }
  };
}

function storeFor(sessionId, remote) {
  let store = stores.get(sessionId);
  if (store) return store;
  store = createStore(sessionId, remote);
  stores.set(sessionId, store);
  return store;
}

function Answer({ text }) {
  const chunks = [];
  const pattern = /```[^\n]*\r?\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) chunks.push(h("span", { key: "t" + chunks.length }, text.slice(last, match.index)));
    chunks.push(h("pre", { key: "c" + chunks.length, className: "btw-code" }, h("code", null, match[1])));
    last = match.index + match[0].length;
  }
  if (last < text.length) chunks.push(h("span", { key: "t" + chunks.length }, text.slice(last)));
  return h("div", { className: "btw-answer" }, chunks);
}

function Turn({ turn, first }) {
  let body;
  if (turn.status === "pending") body = h("div", { className: "btw-status" }, h("span", { className: "btw-spinner", "aria-hidden": "true" }), "正在回答…");
  else if (turn.status === "error") body = h("p", { className: "btw-error" }, turn.error || "btw 失败。");
  else body = h(Answer, { text: turn.answer });
  return h("div", { className: "btw-turn" },
    first ? null : h("div", { className: "btw-turn-q" }, turn.question),
    body
  );
}

function Composer({ disabled, autoFocus, onSend }) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(function () {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, []);
  function send() {
    const question = draft.trim();
    if (!question || disabled) return;
    setDraft("");
    onSend(question);
  }
  function onKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      send();
    }
  }
  return h("div", { className: "btw-compose" },
    h("textarea", {
      ref: inputRef,
      className: "btw-input",
      rows: 1,
      value: draft,
      disabled: disabled,
      placeholder: disabled ? "正在回答…" : "继续这个 btw…（Enter 发送，Shift+Enter 换行）",
      onChange: function (event) { setDraft(event.target.value) },
      onKeyDown: onKeyDown
    }),
    h("button", {
      type: "button",
      className: "btw-send",
      title: "发送 btw",
      "aria-label": "发送 btw",
      disabled: disabled || !draft.trim(),
      onClick: send
    }, h(SendIcon, null))
  );
}

function Box({ box, store }) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef(null);
  const threadRef = React.useRef(null);
  const autoFocusRef = React.useRef(box.autoFocus === true);
  React.useEffect(function () {
    autoFocusRef.current = false;
    return function () { if (timerRef.current) clearTimeout(timerRef.current) };
  }, []);
  React.useEffect(function () {
    const element = threadRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [box.turns, box.collapsed]);
  const latest = box.turns.slice().reverse().find(function (turn) { return turn.answer });
  const pending = box.turns.some(function (turn) { return turn.status === "pending"; });
  const first = box.turns[0];
  function copy() {
    if (!latest || !navigator.clipboard) return;
    navigator.clipboard.writeText(latest.answer).then(function () {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(function () { setCopied(false) }, COPY_FEEDBACK_MS);
    }, function () {});
  }
  return h("div", { className: "btw-bubble" },
    h("div", { className: "btw-header" },
      h("span", { className: "btw-symbol" }, h(MessageIcon, null)),
      h("div", { className: "btw-question", title: first ? first.question : "btw" }, first ? first.question : "btw"),
      box.turns.length > 1 ? h("span", { className: "btw-count" }, box.turns.length + " 轮") : null,
      h("div", { className: "btw-actions" },
        latest ? h("button", {
          type: "button",
          title: copied ? "已复制" : "复制最新回答",
          "aria-label": copied ? "已复制" : "复制最新回答",
          onClick: copy
        }, copied ? h(CheckIcon, null) : h(CopyIcon, null)) : null,
        h("button", {
          type: "button",
          title: box.collapsed ? "展开 btw" : "折叠 btw",
          "aria-label": box.collapsed ? "展开 btw" : "折叠 btw",
          onClick: function () { store.toggleBox(box.id) }
        }, box.collapsed ? h(ChevronDownIcon, null) : h(ChevronUpIcon, null)),
        h("button", {
          type: "button",
          title: "关闭 btw",
          "aria-label": "关闭 btw",
          onClick: function () { store.closeBox(box.id) }
        }, h(XIcon, null))
      )
    ),
    box.collapsed ? null : h("div", { className: "btw-thread", ref: threadRef },
      box.turns.map(function (turn, index) { return h(Turn, { key: turn.id, turn: turn, first: index === 0 }) })
    ),
    box.collapsed ? null : h(Composer, {
      boxId: box.id,
      disabled: pending,
      autoFocus: autoFocusRef.current,
      onSend: function (question) { store.askInBox(box.id, question) }
    })
  );
}

function DockPanel({ store }) {
  const boxes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  if (boxes.length === 0) return null;
  return h("div", { className: "btw-dock" },
    h("div", { className: "btw-bubbles" },
      boxes.map(function (box) { return h(Box, { key: box.id, box: box, store: store }) })
    )
  );
}

function Dock(props) {
  const sessionId = sessionIdOf(props.session);
  const [target, setTarget] = React.useState(null);
  React.useLayoutEffect(function () {
    if (!sessionId) return;
    let cancelled = false;
    let holder = null;
    let frame = 0;
    const place = function () {
      if (cancelled || holder !== null) return;
      const scroll = document.querySelector("[data-conversation-scroll]");
      if (!scroll) {
        frame = requestAnimationFrame(place);
        return;
      }
      holder = document.createElement("div");
      holder.className = "btw-portal";
      const seat = scroll.querySelector(":scope > [data-composer-seat]") || scroll.querySelector("[data-composer-seat]");
      if (seat && seat.parentElement === scroll) scroll.insertBefore(holder, seat);
      else scroll.appendChild(holder);
      setTarget(holder);
    };
    place();
    return function () {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      if (holder) holder.remove();
    };
  }, [sessionId]);
  if (!sessionId) return null;
  const store = storeFor(sessionId, remoteRef);
  const panel = h(DockPanel, { key: sessionId, store: store });
  return target ? ReactDOM.createPortal(panel, target) : panel;
}

function attachOfficialBtw(commandUi, claim) {
  const live = commandUi;
  if (!live) return function () {};
  const restore = [];
  const patch = function (name, wrap) {
    if (typeof live[name] !== "function") return;
    const original = live[name].bind(live);
    live[name] = wrap(original);
    restore.push(function () { live[name] = original });
  };
  patch("dispatch", function (original) {
    return function (pick) {
      return pick.candidate && pick.candidate.name === "btw" ? claim(sessionIdOf(pick.session)) : original(pick);
    };
  });
  patch("matchSpace", function (original) {
    return function (session, token) {
      return token === "/btw" ? claim(sessionIdOf(session)) : original(session, token);
    };
  });
  patch("matchEnter", function (original) {
    return async function (session, line, signal, envelope) {
      if (!/^\/btw(?:\s|$)/.test(line.trim())) return original(session, line, signal, envelope);
      if (envelope && (envelope.attachments || envelope.images)) throw new Error("btw 只接受文字。");
      return claim(sessionIdOf(session));
    };
  });
  patch("execute", function (original) {
    return async function (session, line, attachments) {
      if (!/^\/btw(?:\s|$)/.test(line)) return original(session, line, attachments);
      if (Array.isArray(attachments) && attachments.length) return { kind: "error", text: "btw 只接受文字。" };
      const outcome = claim(sessionIdOf(session));
      if (!outcome || typeof outcome !== "object" || !("claim" in outcome)) return { kind: "error", text: "btw 后端不可用。" };
      try {
        return await outcome.claim.submit(line.replace(/^\/btw\s*/, "").trim(), void 0, []);
      } catch (error) {
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      }
    };
  });
  return function () { restore.forEach(function (dispose) { dispose() }) };
}

function apply(ctx) {
  remoteRef = ctx.remote;
  ctx.effect(function () {
    const style = document.createElement("style");
    style.dataset.dshBtw = "";
    style.textContent = CSS;
    document.head.append(style);
    return function () { style.remove() };
  });
  ctx.slots.inject("conversation.input.dock", function () {
    return ctx.slots.register({ name: "conversation.input.dock", id: "btw", order: -50 }, Dock);
  });
  ctx.slots.inject("conversation.chat.commandview", function () {
    const disposers = ["btw-run", "btw-close"].map(function (key) {
      return ctx.slots.register({ name: "conversation.chat.commandview", key: key }, function () { return null; });
    });
    return function () { disposers.forEach(function (dispose) { dispose() }) };
  });
  function claim(sessionId) {
    return { claim: {
      name: "btw",
      token: "/btw",
      get hint() { return "btw 内容" },
      submit: async function (args, _actx, attachments) {
        if (attachments && attachments.length) return { kind: "error", text: "btw 只接受文字。" };
        const question = String(args || "").trim();
        if (!question) return { kind: "error", text: "请输入 btw 内容。" };
        storeFor(sessionId, remoteRef).createBox(question);
        return { kind: "success" };
      }
    } };
  }
  const attach = function (commandUi) { return attachOfficialBtw(commandUi, claim) };
  if (typeof ctx.inject === "function") ctx.inject(["commandUi"], function (scope) { return attach(scope.get("commandUi")) });
  else ctx.effect(function () { return attach(ctx.get("commandUi")) });
}

const inject = ["slots", "remote", "remote.commands"];

exports.apply = apply;
exports.inject = inject;
return module.exports;
}});
