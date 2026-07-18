import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEkFltSGA-TmL7XJRJdSULDMbH2huGW_s",
  authDomain: "fantamon-boss-builder.firebaseapp.com",
  projectId: "fantamon-boss-builder",
  storageBucket: "fantamon-boss-builder.firebasestorage.app",
  messagingSenderId: "785745841266",
  appId: "1:785745841266:web:034ef601a114d8727906eb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let role = "viewer";
let cloudReady = false;
let applyingRemote = false;
let syncTimer = null;
let knownBossIds = new Set();
let latestBosses = [];
let latestConfig = null;

const statusEl = document.getElementById("firebaseStatus");
const redeemBtn = document.getElementById("redeemInviteBtn");
const generateBtn = document.getElementById("generateInviteBtn");
const copyIdBtn = document.getElementById("copyDeviceIdBtn");

function canEdit() {
  return role === "admin" || role === "editor";
}

function isAdmin() {
  return role === "admin";
}

function updateStatus() {
  document.body.classList.toggle("read-only", !canEdit());

  if (!currentUser) {
    statusEl.textContent = "Conectando ao Firebase...";
  } else if (role === "admin") {
    statusEl.innerHTML = "<strong>Administrador</strong> — edição liberada.";
  } else if (role === "editor") {
    statusEl.innerHTML = "<strong>Editor autorizado</strong> — edição liberada.";
  } else {
    statusEl.innerHTML = "<strong>Visitante</strong> — somente visualização.";
  }

  redeemBtn?.classList.toggle("hidden", !currentUser || canEdit());
  generateBtn?.classList.toggle("hidden", !isAdmin());
}

window.FantamonCloud = {
  canEdit,
  isAdmin,
  applyPermissions: updateStatus,
  queueSync(state) {
    if (!cloudReady || applyingRemote || !canEdit()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncState(state), 450);
  }
};

async function refreshRole() {
  if (!currentUser) return;
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  role = userSnap.exists() ? (userSnap.data().role || "viewer") : "viewer";
  updateStatus();
}

async function syncState(state) {
  if (!canEdit() || applyingRemote) return;

  try {
    const batch = writeBatch(db);
    const localIds = new Set();

    for (const boss of state.bosses || []) {
      localIds.add(boss.id);
      batch.set(doc(db, "bosses", boss.id), boss);
    }

    // Remove do banco apenas Bosses que já sabíamos existir no servidor
    // e que foram excluídos localmente por um editor.
    for (const serverId of knownBossIds) {
      if (!localIds.has(serverId)) {
        batch.delete(doc(db, "bosses", serverId));
      }
    }

    batch.set(doc(db, "config", "app"), {
      classes: state.classes || [],
      customSkills: state.customSkills || {},
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao sincronizar com Firebase:", error);
    alert("Não foi possível salvar as alterações no banco online.");
  }
}

function applyCombinedRemoteData() {
  if (!window.FantamonApp) return;

  applyingRemote = true;
  try {
    window.FantamonApp.replaceSharedData({
      bosses: latestBosses,
      classes: latestConfig?.classes,
      customSkills: latestConfig?.customSkills
    });
  } finally {
    applyingRemote = false;
  }
}

function startRealtimeSync() {
  onSnapshot(collection(db, "bosses"), snapshot => {
    knownBossIds = new Set(snapshot.docs.map(d => d.id));
    latestBosses = snapshot.docs.map(d => d.data());
    applyCombinedRemoteData();
  }, error => {
    console.error("Erro ao carregar Bosses:", error);
  });

  onSnapshot(doc(db, "config", "app"), snapshot => {
    latestConfig = snapshot.exists() ? snapshot.data() : null;
    applyCombinedRemoteData();
  }, error => {
    console.error("Erro ao carregar configuração:", error);
  });
}

function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}

generateBtn?.addEventListener("click", async () => {
  if (!isAdmin() || !currentUser) return;

  const code = randomInviteCode();

  try {
    await setDoc(doc(db, "invites", code), {
      used: false,
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    });

    const inviteUrl = `${location.origin}${location.pathname}?convite=${code}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Convite único criado e copiado para a área de transferência:\\n\\n" + inviteUrl);
    } catch {
      prompt("Convite único criado. Copie o link:", inviteUrl);
    }
  } catch (error) {
    console.error(error);
    alert("Não foi possível gerar o convite.");
  }
});

async function redeemInvite(code) {
  if (!currentUser || !code) return;

  const inviteRef = doc(db, "invites", code);
  const userRef = doc(db, "users", currentUser.uid);

  try {
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      alert("Este convite não existe.");
      return;
    }

    if (inviteSnap.data().used === true) {
      alert("Este convite já foi utilizado.");
      return;
    }

    const batch = writeBatch(db);
    batch.set(userRef, {
      role: "editor",
      inviteId: code,
      authorizedAt: serverTimestamp()
    });
    batch.update(inviteRef, {
      used: true,
      usedBy: currentUser.uid,
      usedAt: serverTimestamp()
    });

    await batch.commit();
    await refreshRole();

    const cleanUrl = `${location.origin}${location.pathname}`;
    history.replaceState({}, "", cleanUrl);

    alert("Convite ativado. Este dispositivo agora é um editor autorizado.");
  } catch (error) {
    console.error("Erro ao ativar convite:", error);
    alert("Não foi possível ativar o convite. Verifique se ele ainda é válido.");
  }
}

redeemBtn?.addEventListener("click", () => {
  const code = prompt("Cole o código do convite:");
  if (code) redeemInvite(code.trim());
});

copyIdBtn?.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Aguarde a conexão com o Firebase.");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentUser.uid);
    alert("ID deste dispositivo copiado:\\n\\n" + currentUser.uid);
  } catch {
    prompt("Copie o ID deste dispositivo:", currentUser.uid);
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) return;

  currentUser = user;
  await refreshRole();

  if (!cloudReady) {
    cloudReady = true;
    startRealtimeSync();
  }

  const inviteCode = new URLSearchParams(location.search).get("convite");
  if (inviteCode && !canEdit()) {
    await redeemInvite(inviteCode);
  }
});

signInAnonymously(auth).catch(error => {
  console.error("Falha na autenticação anônima:", error);
  statusEl.textContent = "Erro ao conectar ao Firebase.";
});
