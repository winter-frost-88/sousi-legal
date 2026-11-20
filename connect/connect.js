"use strict";
const base = "https://dvqsbrbshnxcxynswjrh.supabase.co";
const publicKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2cXNicmJzaG54Y3h5bnN3anJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDQyNDMsImV4cCI6MjA5MjkyMDI0M30.-vwKoyDoneKjeRwpePN64IeC-sepeR5qWkdabZP8ESo";
const $ = id => document.getElementById(id);
const requestID = new URL(location.href).searchParams.get("request");
const validRequest = requestID && /^[A-Za-z0-9_-]{43}$/.test(requestID);
let session = null;
let busy = false;
$("server").textContent = base + "/functions/v1/recipe_mcp";
$("setup").hidden = !!validRequest;
if (requestID && !validRequest) $("status").textContent = "This connection link is invalid. Start again in ChatGPT.";
async function work(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach(b => b.disabled = true);
  $("status").textContent = "";
  try { await action(); }
  catch (error) { $("status").textContent = error.message || "Please try again."; }
  finally { busy = false; document.querySelectorAll("button").forEach(b => b.disabled = false); }
}
async function api(body) {
  const response = await fetch(base + "/functions/v1/recipe_mcp_account", {
    method: "POST", headers: { apikey: publicKey, Authorization: "Bearer " + session, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Your session expired. Reload and sign in again.");
  return data;
}
async function showConnections() {
  const data = await api({ action: "connections" });
  $("connections").hidden = false;
  $("connection-list").replaceChildren();
  if (!data.connections.length) $("connection-list").textContent = "No active connections.";
  for (const connection of data.connections) {
    const row = document.createElement("div"); row.className = "connection";
    const text = document.createElement("p"); text.textContent = "Connected " + new Date(connection.created_at).toLocaleDateString() + (connection.last_seen_at ? " · Last used " + new Date(connection.last_seen_at).toLocaleDateString() : " · Not used yet");
    const button = document.createElement("button"); button.className = "secondary"; button.textContent = "Disconnect";
    button.onclick = () => work(async () => { await api({ action: "revoke", id: connection.id }); await showConnections(); $("status").textContent = "Disconnected. Future access has stopped."; });
    row.append(text, button); $("connection-list").append(row);
  }
}
$("sign-in").onsubmit = event => {
  event.preventDefault();
  work(async () => {
    const password = $("password").value;
    const email = $("email").value.trim();
    $("password").value = "";
    const response = await fetch(base + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: publicKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error("Couldn’t sign in. Check your Sousi email and password, then try again.");
    session = data.access_token; // Memory only; never store passwords or login tokens in browser storage.
    $("login").hidden = true;
    if (validRequest) {
      const details = await api({ action: "details", requestID });
      $("client").textContent = details.clientName + " is requesting access. You will return to " + details.callbackHost + ".";
      $("account").textContent = "Signed in as " + details.email;
      $("recipe-permission").hidden = !details.scopes.includes("recipes:read");
      $("receipt-permission").hidden = !details.scopes.includes("receipts:read");
      $("consent").hidden = false;
    }
    await showConnections();
  });
};
async function decide(approve) {
  const data = await api({ action: "decide", requestID, approve });
  const target = new URL(data.callbackURL);
  if (target.protocol !== "https:" || !["chatgpt.com", "chat.openai.com", "platform.openai.com"].includes(target.hostname)) throw new Error("Unexpected return address. Start again in ChatGPT.");
  session = null;
  location.replace(target.href);
}
$("approve").onclick = () => work(() => decide(true));
$("deny").onclick = () => work(() => decide(false));
$("copy").onclick = () => work(async () => { await navigator.clipboard.writeText($("server").textContent); $("status").textContent = "Server address copied."; });
$("sign-out").onclick = () => { session = null; $("connections").hidden = true; $("consent").hidden = true; $("login").hidden = false; $("status").textContent = "Signed out of this page."; };
