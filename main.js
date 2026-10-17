import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  updateProfile 
} from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, where, serverTimestamp, getDocs, doc, setDoc, writeBatch, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = {
  apiKey: "AIzaSyD-sUbdC9QLa6qNx7nhEfZhfUenG9gbk7I",
  authDomain: "dexter-ai-39dc5.firebaseapp.com",
  projectId: "dexter-ai-39dc5",
  storageBucket: "dexter-ai-39dc5.firebasestorage.app",
  messagingSenderId: "166098528181",
  appId: "1:166098528181:web:29d8ec869751b157eb5bfc",
  measurementId: "G-2VXFZYBVPQ"
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let currentUser = null;
let sessionsUnsubscribe = null;

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW error:', err));
  });
}

// AI Personas Definition
const PERSONAS = {
  default: "You are Dexter, an elite autonomous intelligence companion and cognitive workspace partner with JARVIS-level technological sophistication, razor-sharp logic, and proactive clarity. Provide structured, insightful, clear, and highly accurate answers with production-ready execution.",
  architect: "You are a Principal Software Architect and elite engineer. You write clean, modular, scalable, type-safe, production-grade code. You anticipate edge cases, recommend design patterns, and explain architectural decisions concisely.",
  tutor: "You are an elite academic professor and patient tutor. You break down complex STEM and general topics into intuitive, step-by-step explanations, utilizing analogies, real-world examples, and clear mathematical proofs where relevant.",
  writer: "You are an award-winning executive communications strategist and senior copywriter. You write crisp, compelling, polished, and persuasive prose with immaculate tone, clarity, and formatting.",
  debugger: "You are a seasoned senior security auditor and debugging specialist. You analyze code with laser focus on race conditions, memory leaks, performance bottlenecks, vulnerability vectors, and provide immediate hardened fixes."
};

let currentPersona = localStorage.getItem("dexter_persona") || "default";
let isWebSearchEnabled = false;

const messagesArea = document.getElementById("messages-area");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const fileUpload = document.getElementById("file-upload");
const filePreviewContainer = document.getElementById("file-preview-container");
const imagePreview = document.getElementById("image-preview");
const filePreviewBadge = document.getElementById("file-preview-badge");
const filePreviewIcon = document.getElementById("file-preview-icon");
const filePreviewName = document.getElementById("file-preview-name");
const removeFileBtn = document.getElementById("remove-file-btn");
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const sendButton = document.getElementById("send-button");
const chatContainer = document.getElementById("chat-container");
const scrollToBottomBtn = document.getElementById("scroll-to-bottom");
const voiceButton = document.getElementById("voice-button");
const voiceIcon = document.getElementById("voice-icon");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const collapseInputBtn = document.getElementById("collapse-input-btn");
const collapsedInputPill = document.getElementById("collapsed-input-pill");
const disclaimerText = document.getElementById("disclaimer-text");
const personaSelect = document.getElementById("persona-select");
const exportChatBtn = document.getElementById("export-chat-btn");
const historySearchInput = document.getElementById("history-search-input");
const webSearchToggle = document.getElementById("web-search-toggle");
const webSearchIcon = document.getElementById("web-search-icon");
const sandboxModal = document.getElementById("sandbox-modal");
const sandboxIframe = document.getElementById("sandbox-iframe");
const closeSandboxBtn = document.getElementById("close-sandbox-btn");

// JARVIS 64px Icon Rail Elements
const railLogoBtn = document.getElementById("rail-logo-btn");
const railNewChatBtn = document.getElementById("rail-new-chat-btn");
const railSessionsBtn = document.getElementById("rail-sessions-btn");
const railCanvasBtn = document.getElementById("rail-canvas-btn");
const railImageBtn = document.getElementById("rail-image-btn");
const railSandboxBtn = document.getElementById("rail-sandbox-btn");
const railShortcutsBtn = document.getElementById("rail-shortcuts-btn");
const railSettingsBtn = document.getElementById("rail-settings-btn");
const railThemeBtn = document.getElementById("rail-theme-btn");
const railThemeIcon = document.getElementById("rail-theme-icon");

// Studio Canvas Workstation Elements
const headerCanvasToggleBtn = document.getElementById("header-canvas-toggle-btn");
const rightCanvasPanel = document.getElementById("right-canvas-panel");
const closeCanvasBtn = document.getElementById("close-canvas-btn");
const canvasTabArt = document.getElementById("canvas-tab-art");
const canvasTabSandbox = document.getElementById("canvas-tab-sandbox");
const canvasArtView = document.getElementById("canvas-art-view");
const canvasSandboxView = document.getElementById("canvas-sandbox-view");
const canvasRatioButtons = document.querySelectorAll("#canvas-ratio-buttons .ratio-btn");
const canvasArtContainer = document.getElementById("canvas-art-container");
const canvasArtEmpty = document.getElementById("canvas-art-empty");
const canvasArtLoader = document.getElementById("canvas-art-loader");
const canvasArtImage = document.getElementById("canvas-art-image");
const canvasArtDetails = document.getElementById("canvas-art-details");
const canvasArtPrompt = document.getElementById("canvas-art-prompt");
const canvasArtDimensions = document.getElementById("canvas-art-dimensions");
const canvasArtRemixBtn = document.getElementById("canvas-art-remix-btn");
const canvasArtDownloadBtn = document.getElementById("canvas-art-download-btn");
const canvasFullscreenBtn = document.getElementById("canvas-fullscreen-btn");
const canvasGenerateSampleBtn = document.getElementById("canvas-generate-sample-btn");
const canvasSandboxIframe = document.getElementById("canvas-sandbox-iframe");
const canvasSandboxReloadBtn = document.getElementById("canvas-sandbox-reload-btn");

// JARVIS Talking Core & Audio Waveform Elements
const neuralCoreHero = document.getElementById("neural-core-hero");
const jarvisWaveform = document.getElementById("jarvis-waveform");
const playVoiceIntroBtn = document.getElementById("play-voice-intro-btn");
const voiceIntroIcon = document.getElementById("voice-intro-icon");
const voiceIntroText = document.getElementById("voice-intro-text");
const jarvisSpeechBox = document.querySelector(".jarvis-speech-box");
const jarvisSpeechText = document.getElementById("jarvis-speech-text");
const jarvisVoiceStatus = document.getElementById("jarvis-voice-status");

const slashCommandsMenu = document.getElementById("slash-commands-menu");
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const closeShortcutsBtn = document.getElementById("close-shortcuts-btn");
const dragDropOverlay = document.getElementById("drag-drop-overlay");
const customInstructionsInput = document.getElementById("custom-instructions-input");
const ttsVoiceSelect = document.getElementById("tts-voice-select");
const ttsSpeedSlider = document.getElementById("tts-speed-slider");
const ttsSpeedVal = document.getElementById("tts-speed-val");
const testVoiceBtn = document.getElementById("test-voice-btn");
const renameModal = document.getElementById("rename-modal");
const renameForm = document.getElementById("rename-form");
const renameInput = document.getElementById("rename-input");
const closeRenameBtn = document.getElementById("close-rename-btn");
const cancelRenameBtn = document.getElementById("cancel-rename-btn");

let currentAttachedFile = null;
let lastUserMessage = "";
let lastUserFile = null;
let isRecording = false;
let activeRenamingSessionId = null;
let activeSessionHistory = [];

// Studio Canvas Image State
let currentStudioImage = {
  prompt: "Cyberpunk neon metropolis floating in crystalline clouds, octane render 8k hyperrealistic",
  ratio: "1:1",
  seed: 4291823,
  url: ""
};
let currentStudioView = "art";

if (marked.use) {
  marked.use({
    breaks: true,
    gfm: true
  });
} else if (marked.setOptions) {
  marked.setOptions({
    breaks: true,
    gfm: true
  });
}

// Unified Theme Toggle & Persistence
function applyTheme(isDark) {
  const htmlDoc = document.documentElement;
  htmlDoc.setAttribute("data-theme", isDark ? "dark" : "light");
  try {
    localStorage.setItem("dexter_theme", isDark ? "dark" : "light");
  } catch (e) {}

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", isDark ? "#030712" : "#f8fafc");
  }

  // When dark: show sun icon (click to switch to light)
  // When light: show moon icon (click to switch to dark)
  const iconToAdd = isDark ? "ph-sun" : "ph-moon";

  [themeIcon, railThemeIcon].forEach(icon => {
    if (icon) {
      icon.classList.add("theme-rotate");
      setTimeout(() => icon.classList.remove("theme-rotate"), 400);
      icon.classList.remove("ph-moon", "ph-sun");
      icon.classList.add(iconToAdd);
    }
  });

  const settingsThemeIcon = document.getElementById("settings-theme-icon");
  if (settingsThemeIcon) {
    settingsThemeIcon.classList.remove("ph-moon", "ph-sun");
    settingsThemeIcon.classList.add(iconToAdd);
  }
}

// Initial Theme Sync
const initialIsDark = document.documentElement.getAttribute("data-theme") !== "light";
applyTheme(initialIsDark);

themeToggleBtn.addEventListener("click", () => {
  const isCurrentlyDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(!isCurrentlyDark);
});

if (railThemeBtn) {
  railThemeBtn.addEventListener("click", () => {
    const isCurrentlyDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(!isCurrentlyDark);
  });
}

function isDesktop() {
  return window.innerWidth >= 768;
}

function updateHeaderControls(isSidebarOpen) {
  const headerBrand = document.getElementById("header-brand");
  const toggleBtn = document.getElementById("toggle-sidebar");
  if (isDesktop()) {
    if (headerBrand) {
      headerBrand.classList.toggle("hidden", isSidebarOpen);
      headerBrand.classList.toggle("flex", !isSidebarOpen);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle("hidden", isSidebarOpen);
      toggleBtn.classList.toggle("flex", !isSidebarOpen);
    }
  } else {
    // On mobile screens, always show toggle button and header brand
    if (headerBrand) {
      headerBrand.classList.remove("hidden");
      headerBrand.classList.add("flex");
    }
    if (toggleBtn) {
      toggleBtn.classList.remove("hidden");
      toggleBtn.classList.add("flex");
    }
  }
}
const updateHeaderBrandVisibility = updateHeaderControls;

function toggleSidebar(forceState) {
  if (isDesktop()) {
    const isCurrentlyCollapsed = sidebar.classList.contains("collapsed");
    // Default desktop state is OPEN (not collapsed)
    const shouldOpen = forceState !== undefined ? forceState : isCurrentlyCollapsed;

    sidebar.classList.toggle("collapsed", !shouldOpen);
    sidebar.classList.toggle("drawer-open", shouldOpen);
    if (railSessionsBtn) railSessionsBtn.classList.toggle("active", shouldOpen);
    updateHeaderBrandVisibility(shouldOpen);

    // On desktop, never display the blocking backdrop overlay
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.add("hidden");
      sidebarBackdrop.classList.remove("opacity-100");
    }

    try {
      localStorage.setItem("dexter_sidebar_open", shouldOpen ? "true" : "false");
    } catch (e) {}
  } else {
    // Mobile slide-over drawer
    const isClosed = sidebar.classList.contains("-translate-x-full") || sidebar.classList.contains("collapsed");
    const shouldOpen = forceState !== undefined ? forceState : isClosed;

    if (shouldOpen) {
      sidebar.classList.remove("-translate-x-full", "collapsed");
      sidebar.classList.add("drawer-open");
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove("hidden");
        setTimeout(() => sidebarBackdrop.classList.add("opacity-100"), 10);
      }
    } else {
      sidebar.classList.add("-translate-x-full", "collapsed");
      sidebar.classList.remove("drawer-open");
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.remove("opacity-100");
        setTimeout(() => sidebarBackdrop.classList.add("hidden"), 200);
      }
    }
  }
}

// Initialize Sidebar: Default OPEN on desktop, closed drawer on mobile
function initSidebarState() {
  if (isDesktop()) {
    let shouldOpen = true;
    try {
      const saved = localStorage.getItem("dexter_sidebar_open");
      if (saved === "false") shouldOpen = false;
    } catch (e) {}

    sidebar.classList.toggle("collapsed", !shouldOpen);
    sidebar.classList.toggle("drawer-open", shouldOpen);
    sidebar.classList.remove("-translate-x-full");
    if (railSessionsBtn) railSessionsBtn.classList.toggle("active", shouldOpen);
    updateHeaderBrandVisibility(shouldOpen);
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.add("hidden");
      sidebarBackdrop.classList.remove("opacity-100");
    }
  } else {
    sidebar.classList.add("-translate-x-full", "collapsed");
    sidebar.classList.remove("drawer-open");
    updateHeaderBrandVisibility(false);
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.add("hidden");
      sidebarBackdrop.classList.remove("opacity-100");
    }
  }
}

initSidebarState();

window.addEventListener("resize", () => {
  if (isDesktop()) {
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.add("hidden");
      sidebarBackdrop.classList.remove("opacity-100");
    }
    sidebar.classList.remove("-translate-x-full");
    let shouldOpen = true;
    try {
      const saved = localStorage.getItem("dexter_sidebar_open");
      if (saved === "false") shouldOpen = false;
    } catch (e) {}
    sidebar.classList.toggle("collapsed", !shouldOpen);
    sidebar.classList.toggle("drawer-open", shouldOpen);
    if (railSessionsBtn) railSessionsBtn.classList.toggle("active", shouldOpen);
    updateHeaderBrandVisibility(shouldOpen);
  } else {
    if (!sidebar.classList.contains("drawer-open")) {
      sidebar.classList.add("-translate-x-full", "collapsed");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
    }
    updateHeaderBrandVisibility(false);
  }
});

// Rail Navigation Hooks
if (railNewChatBtn) {
  railNewChatBtn.addEventListener("click", () => {
    const newChatBtn = document.getElementById("new-chat-btn");
    newChatBtn?.click();
  });
}

if (railSessionsBtn) {
  railSessionsBtn.addEventListener("click", () => {
    toggleSidebar();
  });
}

if (railShortcutsBtn) {
  railShortcutsBtn.addEventListener("click", () => {
    toggleShortcutsModal();
  });
}

if (railSettingsBtn) {
  railSettingsBtn.addEventListener("click", () => {
    toggleSettings();
  });
}

if (railLogoBtn) {
  railLogoBtn.addEventListener("click", () => {
    const newChatBtn = document.getElementById("new-chat-btn");
    newChatBtn?.click();
  });
}

toggleSidebarBtn.addEventListener("click", () => toggleSidebar());
closeSidebarBtn.addEventListener("click", () => toggleSidebar(false));
sidebarBackdrop.addEventListener("click", () => toggleSidebar(false));

const settingsModal = document.getElementById("settings-modal");
const openSettingsBtn = document.getElementById("open-settings-btn");
const closeSettingsBtn = document.querySelector(".close-settings");
const settingsBackdrop = document.querySelector(".modal-backdrop");
const settingsThemeToggle = document.getElementById("settings-theme-toggle");
const settingsThemeIcon = document.getElementById("settings-theme-icon");
const clearDataBtn = document.getElementById("clear-data-btn");

function toggleSettings() {
  if (settingsModal.classList.contains("hidden")) {
    settingsModal.classList.remove("hidden");
    settingsModal.classList.add("flex");
  } else {
    settingsModal.classList.add("hidden");
    settingsModal.classList.remove("flex");
  }
}

if(openSettingsBtn) openSettingsBtn.addEventListener("click", () => {
  if (window.innerWidth < 768) toggleSidebar();
  toggleSettings();
});
if(closeSettingsBtn) closeSettingsBtn.addEventListener("click", toggleSettings);
if(settingsBackdrop) settingsBackdrop.addEventListener("click", toggleSettings);

if(settingsThemeToggle) {
  settingsThemeToggle.addEventListener("click", () => {
    themeToggleBtn.click();
    if (document.documentElement.getAttribute("data-theme") === "dark") {
      settingsThemeIcon.classList.replace("ph-moon", "ph-sun");
    } else {
      settingsThemeIcon.classList.replace("ph-sun", "ph-moon");
    }
  });
}

if(clearDataBtn) {
  clearDataBtn.addEventListener("click", async () => {
    if(confirm("Are you sure you want to delete chat history for this account? This cannot be undone.")) {
      clearDataBtn.disabled = true;
      clearDataBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Clearing...';
      try {
        const effectiveUserId = currentUser ? currentUser.uid : getGuestId();
        const q = query(collection(db, "sessions"), where("userId", "==", effectiveUserId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        currentSessionId = null;
        clearMessages();
        toggleSettings();
      } catch (error) {
        console.error("Error clearing data:", error);
        alert("Failed to clear history.");
      } finally {
        clearDataBtn.disabled = false;
        clearDataBtn.innerHTML = '<i class="ph ph-trash"></i> Clear All Chat History';
      }
    }
  });
}

// ==========================================
// DEXTER MULTI-ACCOUNT AUTHENTICATION SYSTEM
// ==========================================
const authModal = document.getElementById("auth-modal");
const closeAuthModalBtn = document.getElementById("close-auth-modal");
const authTabSignin = document.getElementById("auth-tab-signin");
const authTabSignup = document.getElementById("auth-tab-signup");
const authForm = document.getElementById("auth-form");
const authNameGroup = document.getElementById("auth-name-group");
const authNameInput = document.getElementById("auth-name-input");
const authEmailInput = document.getElementById("auth-email-input");
const authPasswordInput = document.getElementById("auth-password-input");
const authPasswordHint = document.getElementById("auth-password-hint");
const toggleAuthPasswordBtn = document.getElementById("toggle-auth-password");
const toggleAuthPasswordIcon = document.getElementById("toggle-auth-password-icon");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authSubmitText = document.getElementById("auth-submit-text");
const authAlert = document.getElementById("auth-alert");
const authAlertIcon = document.getElementById("auth-alert-icon");
const authAlertText = document.getElementById("auth-alert-text");
const authGoogleBtn = document.getElementById("auth-google-btn");
const authGuestBtn = document.getElementById("auth-guest-btn");
const openAuthBtn = document.getElementById("open-auth-btn");
const authActionBtn = document.getElementById("auth-action-btn");
const authActionText = document.getElementById("auth-action-text");
const userDisplayName = document.getElementById("user-display-name");
const headerAuthBtn = document.getElementById("header-auth-btn");
const headerAuthLabel = document.getElementById("header-auth-label");
const railAuthBtn = document.getElementById("rail-auth-btn");

let currentAuthMode = "signin"; // 'signin' or 'signup'

function getGuestId() {
  let guestId = localStorage.getItem("dexter_guest_id");
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("dexter_guest_id", guestId);
  }
  return guestId;
}

function openAuthModal(mode = "signin") {
  if (!authModal) return;
  setAuthMode(mode);
  hideAuthAlert();
  authModal.classList.remove("hidden");
  authModal.classList.add("flex");
  setTimeout(() => {
    if (currentAuthMode === "signup" && authNameInput) {
      authNameInput.focus();
    } else if (authEmailInput) {
      authEmailInput.focus();
    }
  }, 100);
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.add("hidden");
  authModal.classList.remove("flex");
  hideAuthAlert();
  if (authForm) authForm.reset();
}

function setAuthMode(mode) {
  currentAuthMode = mode;
  hideAuthAlert();
  if (mode === "signin") {
    authTabSignin?.classList.add("bg-card", "text-cyan-400", "shadow-sm");
    authTabSignin?.classList.remove("text-muted-foreground");
    authTabSignup?.classList.remove("bg-card", "text-cyan-400", "shadow-sm");
    authTabSignup?.classList.add("text-muted-foreground");
    authNameGroup?.classList.add("hidden");
    authPasswordHint?.classList.add("hidden");
    if (authSubmitText) authSubmitText.textContent = "Sign In";
    if (authNameInput) authNameInput.required = false;
  } else {
    authTabSignup?.classList.add("bg-card", "text-cyan-400", "shadow-sm");
    authTabSignup?.classList.remove("text-muted-foreground");
    authTabSignin?.classList.remove("bg-card", "text-cyan-400", "shadow-sm");
    authTabSignin?.classList.add("text-muted-foreground");
    authNameGroup?.classList.remove("hidden");
    authPasswordHint?.classList.remove("hidden");
    if (authSubmitText) authSubmitText.textContent = "Create Account";
    if (authNameInput) authNameInput.required = true;
  }
}

function showAuthAlert(msg, type = "error") {
  if (!authAlert || !authAlertText) return;
  authAlertText.textContent = msg;
  authAlert.classList.remove("hidden");
  if (type === "error") {
    authAlert.className = "p-3 rounded-2xl text-xs font-medium border mb-3 flex items-start gap-2 bg-destructive/10 text-destructive border-destructive/20";
    if (authAlertIcon) authAlertIcon.className = "ph-bold ph-warning-circle text-base mt-0.5 shrink-0";
  } else {
    authAlert.className = "p-3 rounded-2xl text-xs font-medium border mb-3 flex items-start gap-2 bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    if (authAlertIcon) authAlertIcon.className = "ph-bold ph-check-circle text-base mt-0.5 shrink-0";
  }
}

function hideAuthAlert() {
  if (authAlert) authAlert.classList.add("hidden");
}

function updateUserUI(user) {
  if (user) {
    const name = user.displayName || (user.email ? user.email.split("@")[0] : "Student User");
    if (userDisplayName) userDisplayName.textContent = name;
    if (authActionText) authActionText.textContent = "Sign Out";
    if (headerAuthLabel) headerAuthLabel.textContent = name.length > 10 ? name.substring(0, 8) + "..." : name;
    if (headerAuthBtn) headerAuthBtn.title = `Signed in as ${user.email || name}`;
  } else {
    if (userDisplayName) userDisplayName.textContent = "Guest User";
    if (authActionText) authActionText.textContent = "Log In";
    if (headerAuthLabel) headerAuthLabel.textContent = "Log In";
    if (headerAuthBtn) headerAuthBtn.title = "Log in or create account";
  }
}

if (authTabSignin) authTabSignin.addEventListener("click", () => setAuthMode("signin"));
if (authTabSignup) authTabSignup.addEventListener("click", () => setAuthMode("signup"));
if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", closeAuthModal);

const authBackdrop = document.querySelector(".auth-backdrop");
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);

if (openAuthBtn) {
  openAuthBtn.addEventListener("click", () => {
    if (!currentUser) openAuthModal("signin");
  });
}
if (headerAuthBtn) {
  headerAuthBtn.addEventListener("click", () => {
    if (!currentUser) openAuthModal("signin");
    else if (confirm(`Signed in as ${currentUser.displayName || currentUser.email}. Do you want to sign out?`)) {
      signOut(auth).then(() => {
        currentSessionId = null;
        clearMessages();
        openAuthModal("signin");
      });
    }
  });
}
if (railAuthBtn) {
  railAuthBtn.addEventListener("click", () => {
    if (!currentUser) openAuthModal("signin");
    else if (confirm(`Signed in as ${currentUser.displayName || currentUser.email}. Do you want to sign out?`)) {
      signOut(auth).then(() => {
        currentSessionId = null;
        clearMessages();
        openAuthModal("signin");
      });
    }
  });
}

if (authActionBtn) {
  authActionBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (currentUser) {
      if (confirm(`Sign out of ${currentUser.displayName || currentUser.email || "Dexter"}?`)) {
        await signOut(auth);
        currentSessionId = null;
        clearMessages();
        openAuthModal("signin");
      }
    } else {
      openAuthModal("signin");
    }
  });
}

if (toggleAuthPasswordBtn && authPasswordInput && toggleAuthPasswordIcon) {
  toggleAuthPasswordBtn.addEventListener("click", () => {
    const isPass = authPasswordInput.type === "password";
    authPasswordInput.type = isPass ? "text" : "password";
    toggleAuthPasswordIcon.className = isPass ? "ph ph-eye-slash" : "ph ph-eye";
  });
}

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthAlert();
    const email = authEmailInput?.value.trim();
    const password = authPasswordInput?.value;
    const name = authNameInput?.value.trim();

    if (!email || !password) {
      showAuthAlert("Please provide both email and password.");
      return;
    }

    if (password.length < 6) {
      showAuthAlert("Password must be at least 6 characters.");
      return;
    }

    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
      authSubmitBtn.classList.add("opacity-75");
      if (authSubmitText) authSubmitText.textContent = currentAuthMode === "signup" ? "Creating Account..." : "Signing In...";
    }

    try {
      if (currentAuthMode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name && userCredential.user) {
          try {
            await updateProfile(userCredential.user, { displayName: name });
          } catch (e) {}
        }
        showAuthAlert("Account created successfully! Connecting neural deck...", "success");
        setTimeout(() => closeAuthModal(), 700);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showAuthAlert("Authenticated successfully! Loading your sessions...", "success");
        setTimeout(() => closeAuthModal(), 700);
      }
    } catch (err) {
      console.warn("Auth error:", err);
      let userFriendlyMsg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/invalid-email") userFriendlyMsg = "Please enter a valid email address.";
      else if (err.code === "auth/user-not-found") userFriendlyMsg = "No account found with this email. Switch to 'Create Account' to sign up.";
      else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") userFriendlyMsg = "Invalid credentials. Please verify your email and password.";
      else if (err.code === "auth/email-already-in-use") userFriendlyMsg = "This email is already registered. Please sign in instead.";
      else if (err.code === "auth/weak-password") userFriendlyMsg = "Password must be at least 6 characters.";
      else if (err.message) userFriendlyMsg = err.message;
      showAuthAlert(userFriendlyMsg);
    } finally {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.classList.remove("opacity-75");
        if (authSubmitText) authSubmitText.textContent = currentAuthMode === "signup" ? "Create Account" : "Sign In";
      }
    }
  });
}

if (authGoogleBtn) {
  authGoogleBtn.addEventListener("click", async () => {
    hideAuthAlert();
    try {
      await signInWithPopup(auth, googleProvider);
      closeAuthModal();
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.warn("Google Sign-In error:", err);
        showAuthAlert("Google sign-in was cancelled or encountered an issue.");
      }
    }
  });
}

if (authGuestBtn) {
  authGuestBtn.addEventListener("click", () => {
    closeAuthModal();
  });
}

// Global Firebase Auth State Listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateUserUI(user);
  currentSessionId = null;
  clearMessages();
  initSidebarSessionsListener();

  // If not logged in, pop open the login modal on first visit for easy sign-in & screenshots!
  if (!user && !sessionStorage.getItem("dexter_auth_seen")) {
    sessionStorage.setItem("dexter_auth_seen", "true");
    setTimeout(() => {
      openAuthModal("signin");
    }, 800);
  }
});

chatContainer.addEventListener("scroll", () => {
  const isScrolledUp = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 100;
  if (isScrolledUp) {
    scrollToBottomBtn.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
  } else {
    scrollToBottomBtn.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
  }
});

scrollToBottomBtn.addEventListener("click", () => {
  scrollToBottom();
});


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    voiceIcon.classList.replace("ph-microphone", "ph-stop-circle");
    voiceIcon.classList.add("text-red-500", "animate-pulse");
    messageInput.placeholder = "Listening...";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    messageInput.value = transcript;
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };

  function stopRecording() {
    isRecording = false;
    voiceIcon.classList.replace("ph-stop-circle", "ph-microphone");
    voiceIcon.classList.remove("text-red-500", "animate-pulse");
    messageInput.placeholder = "Message Dexter...";
  }

  voiceButton.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
    } else {
      messageInput.value = "";
      recognition.start();
    }
  });
} else {
  voiceButton.style.display = "none";
}


// Persona Selector & Cyber Aura Synchronization
function applyPersona(persona) {
  currentPersona = persona || "default";
  localStorage.setItem("dexter_persona", currentPersona);
  document.documentElement.setAttribute("data-persona", currentPersona);
}
applyPersona(currentPersona);

if (personaSelect) {
  personaSelect.value = currentPersona;
  personaSelect.addEventListener("change", (e) => {
    applyPersona(e.target.value);
  });
}

// Google Web Search Toggle
if (webSearchToggle) {
  webSearchToggle.addEventListener("click", () => {
    isWebSearchEnabled = !isWebSearchEnabled;
    if (isWebSearchEnabled) {
      webSearchToggle.classList.add("bg-indigo-500/20", "text-indigo-600", "dark:text-indigo-400", "ring-1", "ring-indigo-500/40");
      webSearchToggle.title = "Live Web Search: Enabled (Gemini Google Grounding)";
    } else {
      webSearchToggle.classList.remove("bg-indigo-500/20", "text-indigo-600", "dark:text-indigo-400", "ring-1", "ring-indigo-500/40");
      webSearchToggle.title = "Toggle Live Web Search";
    }
  });
}

// History Search
if (historySearchInput) {
  historySearchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const historyList = document.getElementById("chat-history-list");
    if (!historyList) return;
    const items = historyList.querySelectorAll("[data-session-id]");
    items.forEach(item => {
      const title = (item.innerText || "").toLowerCase();
      if (!term || title.includes(term)) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    });
  });
}

// Export Conversation
if (exportChatBtn) {
  exportChatBtn.addEventListener("click", () => {
    const allChildren = Array.from(messagesArea.children).filter(c => c.id !== "welcome-screen");
    if (allChildren.length === 0) {
      alert("No messages to export yet.");
      return;
    }
    let markdown = `# Dexter AI Conversation Export\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    allChildren.forEach(msg => {
      const isUser = msg.classList.contains("justify-end");
      const bubble = msg.querySelector(".markdown-body") || msg.querySelector(".bg-gradient-to-r");
      const text = bubble ? (bubble.dataset.rawText || bubble.innerText || "") : "";
      if (isUser) {
        markdown += `### 👤 User\n${text}\n\n`;
      } else {
        markdown += `### 🤖 Dexter AI\n${text}\n\n---\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dexter-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Sandbox Modal Logic
function openSandbox(code) {
  if (sandboxIframe && sandboxModal) {
    sandboxIframe.srcdoc = code;
    sandboxModal.classList.remove("hidden");
    sandboxModal.classList.add("flex");
  }
}
function closeSandbox() {
  if (sandboxModal && sandboxIframe) {
    sandboxModal.classList.add("hidden");
    sandboxModal.classList.remove("flex");
    sandboxIframe.srcdoc = "";
  }
}
if (closeSandboxBtn) closeSandboxBtn.addEventListener("click", closeSandbox);
if (sandboxModal) {
  sandboxModal.querySelector(".sandbox-backdrop")?.addEventListener("click", closeSandbox);
}

// ==========================================
// RIGHT STUDIO CANVAS WORKSTATION SYSTEM
// ==========================================
function toggleStudioCanvas(forceState) {
  if (!rightCanvasPanel) return;
  const isCollapsed = rightCanvasPanel.classList.contains("collapsed");
  const shouldOpen = forceState !== undefined ? forceState : isCollapsed;
  
  if (shouldOpen) {
    rightCanvasPanel.classList.remove("collapsed");
  } else {
    rightCanvasPanel.classList.add("collapsed");
  }
  
  if (railCanvasBtn) railCanvasBtn.classList.toggle("active", shouldOpen);
  if (headerCanvasToggleBtn) {
    headerCanvasToggleBtn.classList.toggle("bg-cyan-500/20", shouldOpen);
    headerCanvasToggleBtn.classList.toggle("border-cyan-400", shouldOpen);
  }
}

function switchStudioTab(tab) {
  currentStudioView = tab;
  if (tab === "art") {
    canvasTabArt?.classList.add("bg-primary", "text-primary-foreground", "shadow-sm");
    canvasTabArt?.classList.remove("text-muted-foreground");
    canvasTabSandbox?.classList.remove("bg-primary", "text-primary-foreground", "shadow-sm");
    canvasTabSandbox?.classList.add("text-muted-foreground");
    canvasArtView?.classList.remove("hidden");
    canvasSandboxView?.classList.add("hidden");
  } else {
    canvasTabSandbox?.classList.add("bg-primary", "text-primary-foreground", "shadow-sm");
    canvasTabSandbox?.classList.remove("text-muted-foreground");
    canvasTabArt?.classList.remove("bg-primary", "text-primary-foreground", "shadow-sm");
    canvasTabArt?.classList.add("text-muted-foreground");
    canvasSandboxView?.classList.remove("hidden");
    canvasArtView?.classList.add("hidden");
  }
}

function openInStudioSandbox(htmlCode) {
  if (canvasSandboxIframe) {
    canvasSandboxIframe.srcdoc = htmlCode;
  }
  switchStudioTab("sandbox");
  toggleStudioCanvas(true);
}

function updateStudioCanvasImage(prompt, seed = null, ratio = null) {
  if (!rightCanvasPanel) return;
  
  if (prompt) currentStudioImage.prompt = prompt;
  if (seed !== null && seed !== undefined) currentStudioImage.seed = seed;
  if (ratio) currentStudioImage.ratio = ratio;

  let width = 1024, height = 1024;
  switch (currentStudioImage.ratio) {
    case "16:9":
      width = 1280; height = 720; break;
    case "9:16":
      width = 720; height = 1280; break;
    case "4:3":
      width = 1024; height = 768; break;
    case "1:1":
    default:
      width = 1024; height = 1024; break;
  }

  const generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(currentStudioImage.prompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${currentStudioImage.seed}`;
  currentStudioImage.url = generatedUrl;

  switchStudioTab("art");

  if (canvasArtEmpty) canvasArtEmpty.classList.add("hidden");
  if (canvasArtLoader) canvasArtLoader.classList.remove("hidden");
  if (canvasArtImage) {
    canvasArtImage.classList.add("hidden");
    canvasArtImage.src = generatedUrl;
    canvasArtImage.onload = () => {
      if (canvasArtLoader) canvasArtLoader.classList.add("hidden");
      canvasArtImage.classList.remove("hidden");
    };
    canvasArtImage.onerror = () => {
      if (canvasArtLoader) canvasArtLoader.classList.add("hidden");
    };
  }

  if (canvasArtDetails) {
    canvasArtDetails.classList.remove("hidden");
    canvasArtDetails.classList.add("flex");
  }
  if (canvasArtPrompt) canvasArtPrompt.textContent = `"${currentStudioImage.prompt}"`;
  if (canvasArtDimensions) canvasArtDimensions.textContent = `${width} × ${height} · FLUX (${currentStudioImage.ratio})`;
  if (canvasArtDownloadBtn) {
    canvasArtDownloadBtn.href = generatedUrl;
    canvasArtDownloadBtn.download = `dexter-flux-${currentStudioImage.seed}.jpg`;
  }

  canvasRatioButtons.forEach(btn => {
    const isBtnRatio = btn.dataset.ratio === currentStudioImage.ratio;
    btn.className = isBtnRatio 
      ? "ratio-btn px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold bg-primary text-primary-foreground"
      : "ratio-btn px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary";
  });
}

// Canvas Buttons Event Listeners
if (headerCanvasToggleBtn) headerCanvasToggleBtn.addEventListener("click", () => toggleStudioCanvas());
if (closeCanvasBtn) closeCanvasBtn.addEventListener("click", () => toggleStudioCanvas(false));
if (railCanvasBtn) railCanvasBtn.addEventListener("click", () => toggleStudioCanvas());

if (railImageBtn) {
  railImageBtn.addEventListener("click", () => {
    switchStudioTab("art");
    toggleStudioCanvas(true);
    expandInput();
    if (!messageInput.value.startsWith("/image ")) {
      messageInput.value = "/image " + messageInput.value.replace(/^\/image\s*/, "");
    }
    messageInput.focus();
  });
}

if (railSandboxBtn) {
  railSandboxBtn.addEventListener("click", () => {
    switchStudioTab("sandbox");
    toggleStudioCanvas(true);
  });
}

if (canvasTabArt) canvasTabArt.addEventListener("click", () => switchStudioTab("art"));
if (canvasTabSandbox) canvasTabSandbox.addEventListener("click", () => switchStudioTab("sandbox"));

canvasRatioButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const newRatio = btn.dataset.ratio;
    updateStudioCanvasImage(currentStudioImage.prompt, currentStudioImage.seed, newRatio);
  });
});

if (canvasArtRemixBtn) {
  canvasArtRemixBtn.addEventListener("click", () => {
    const newSeed = Math.floor(Math.random() * 9999999);
    updateStudioCanvasImage(currentStudioImage.prompt, newSeed, currentStudioImage.ratio);
  });
}

if (canvasFullscreenBtn) {
  canvasFullscreenBtn.addEventListener("click", () => {
    if (currentStudioView === "art" && currentStudioImage.url) {
      window.open(currentStudioImage.url, "_blank");
    } else if (currentStudioView === "sandbox") {
      openSandbox(canvasSandboxIframe?.srcdoc || "");
    }
  });
}

if (canvasSandboxReloadBtn) {
  canvasSandboxReloadBtn.addEventListener("click", () => {
    if (canvasSandboxIframe) {
      const src = canvasSandboxIframe.srcdoc;
      canvasSandboxIframe.srcdoc = "";
      setTimeout(() => { canvasSandboxIframe.srcdoc = src; }, 50);
    }
  });
}

if (canvasGenerateSampleBtn) {
  canvasGenerateSampleBtn.addEventListener("click", () => {
    expandInput();
    messageInput.value = "/image Cyberpunk neon metropolis floating in crystalline clouds, octane render 8k hyperrealistic";
    chatForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  });
}

// ==========================================
// AUTONOMOUS DEXTER VOICE ENGINE & REAL-TIME AUDIO SPECTRUM
// ==========================================
const dexterVoiceAudio = document.getElementById("dexter-voice-audio");
let hasVoicePlayed = false;
let audioVisualizerFrame = null;
let audioContext = null;
let audioAnalyser = null;
let audioSource = null;
let audioBeatTimeout = null;

let audioVocoderFilter = null;

function setupAudioSpectrumAnalyser() {
  if (audioContext || !dexterVoiceAudio) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
    audioSource = audioContext.createMediaElementSource(dexterVoiceAudio);
    
    // Cybernetic vocoder resonator node for crisp robotic JARVIS voice
    audioVocoderFilter = audioContext.createBiquadFilter();
    audioVocoderFilter.type = "peaking";
    audioVocoderFilter.frequency.value = 1680;
    audioVocoderFilter.Q.value = 5.2;
    audioVocoderFilter.gain.value = 7.5;

    audioAnalyser = audioContext.createAnalyser();
    audioAnalyser.fftSize = 64;

    audioSource.connect(audioVocoderFilter);
    audioVocoderFilter.connect(audioAnalyser);
    audioAnalyser.connect(audioContext.destination);
  } catch (err) {
    console.warn("AudioContext setup notice:", err);
  }
}

function startRealAudioVisualizer() {
  if (!jarvisWaveform) return;
  const bars = jarvisWaveform.querySelectorAll(".bar");
  const dataArray = audioAnalyser ? new Uint8Array(audioAnalyser.frequencyBinCount) : null;

  function renderFrame() {
    if (audioAnalyser && dataArray) {
      audioAnalyser.getByteFrequencyData(dataArray);
      let totalEnergy = 0;
      bars.forEach((bar, idx) => {
        const binIndex = Math.min(idx * 2, dataArray.length - 1);
        const val = dataArray[binIndex] || 0;
        totalEnergy += val;
        const height = Math.max(4, Math.min(26, Math.round((val / 255) * 26)));
        bar.style.height = `${height}px`;
      });
      // Word / Syllable Cadence Punch on vocal energy peaks
      if (bars.length > 0 && (totalEnergy / bars.length) > 115 && neuralCoreHero && !neuralCoreHero.classList.contains("beat-punch")) {
        neuralCoreHero.classList.add("beat-punch");
        if (audioBeatTimeout) clearTimeout(audioBeatTimeout);
        audioBeatTimeout = setTimeout(() => {
          if (neuralCoreHero) neuralCoreHero.classList.remove("beat-punch");
        }, 120);
      }
    } else {
      // Harmonic wave superposition fallback
      const elapsed = performance.now() / 1000;
      bars.forEach((bar, idx) => {
        const wave = (Math.sin(elapsed * 9 + idx * 0.7) + Math.cos(elapsed * 4.5 + idx * 1.2) + 2) / 4;
        bar.style.height = `${Math.round(4 + wave * 22)}px`;
      });
    }
    audioVisualizerFrame = requestAnimationFrame(renderFrame);
  }

  if (audioVisualizerFrame) cancelAnimationFrame(audioVisualizerFrame);
  audioVisualizerFrame = requestAnimationFrame(renderFrame);
}

function stopRealAudioVisualizer() {
  if (audioVisualizerFrame) {
    cancelAnimationFrame(audioVisualizerFrame);
    audioVisualizerFrame = null;
  }
  if (audioBeatTimeout) {
    clearTimeout(audioBeatTimeout);
    audioBeatTimeout = null;
  }
  if (neuralCoreHero) {
    neuralCoreHero.classList.remove("beat-punch");
    neuralCoreHero.classList.remove("speaking");
    neuralCoreHero.classList.remove("thinking");
  }
  if (jarvisWaveform) {
    jarvisWaveform.classList.remove("speaking");
    const bars = jarvisWaveform.querySelectorAll(".bar");
    bars.forEach((b) => {
      b.style.height = "";
    });
  }
}

function playDexterGreeting() {
  if (!dexterVoiceAudio) return;

  setupAudioSpectrumAnalyser();
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  if (!dexterVoiceAudio.src || !dexterVoiceAudio.src.includes("dexter-greeting.wav")) {
    dexterVoiceAudio.src = "/audio/dexter-greeting.wav";
  }

  dexterVoiceAudio.currentTime = 0;
  const playPromise = dexterVoiceAudio.play();

  if (playPromise !== undefined) {
    playPromise.then(() => {
      hasVoicePlayed = true;
      removeAutoPlayUnlockListeners();
      if (neuralCoreHero) {
        neuralCoreHero.classList.add("speaking");
        neuralCoreHero.classList.add("thinking");
      }
      if (jarvisWaveform) jarvisWaveform.classList.add("speaking");
      startRealAudioVisualizer();
    }).catch((err) => {
      console.log("Autonomous audio waiting for user activation:", err);
    });
  }

  dexterVoiceAudio.onended = () => {
    stopRealAudioVisualizer();
  };

  dexterVoiceAudio.onerror = (e) => {
    console.warn("Audio playback error:", e);
    stopRealAudioVisualizer();
  };
}

// Automatic Voice Playback on Opening the App (Zero Buttons)
const AUTOPLAY_EVENTS = ["pointerdown", "click", "touchstart", "keydown", "wheel", "mousemove", "scroll", "focus"];

function unlockAndPlayVoice() {
  if (hasVoicePlayed) return;
  playDexterGreeting();
}

function setupAutoPlayUnlockListeners() {
  AUTOPLAY_EVENTS.forEach((evt) => {
    window.addEventListener(evt, unlockAndPlayVoice, { capture: true, passive: true });
    document.addEventListener(evt, unlockAndPlayVoice, { capture: true, passive: true });
  });
}

function removeAutoPlayUnlockListeners() {
  AUTOPLAY_EVENTS.forEach((evt) => {
    window.removeEventListener(evt, unlockAndPlayVoice, { capture: true });
    document.removeEventListener(evt, unlockAndPlayVoice, { capture: true });
  });
}

function autoPlayVoiceOnOpen() {
  if (hasVoicePlayed) return;
  setTimeout(() => {
    if (!hasVoicePlayed) {
      playDexterGreeting();
    }
  }, 100);
}

setupAutoPlayUnlockListeners();

// Replay or pause voice greeting by tapping the Arc Reactor directly
if (neuralCoreHero) {
  neuralCoreHero.addEventListener("click", () => {
    if (!dexterVoiceAudio) return;
    if (!dexterVoiceAudio.paused) {
      dexterVoiceAudio.pause();
      dexterVoiceAudio.currentTime = 0;
      stopRealAudioVisualizer();
    } else {
      hasVoicePlayed = false;
      playDexterGreeting();
    }
  });
}

// Multi-Format File Upload & Drag-and-Drop Handling
function handleSelectedFile(file) {
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  const isPdf = file.type === "application/pdf";
  const isText = file.type.startsWith("text/") || 
                 file.name.match(/\.(txt|md|csv|json|js|ts|py|html|css|xml|sql|sh)$/i);

  if (isImage) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      imagePreview.src = base64String;
      imagePreview.classList.remove("hidden");
      filePreviewBadge.classList.add("hidden");
      filePreviewContainer.classList.remove("hidden");

      currentAttachedFile = {
        type: "image",
        mimeType: file.type,
        base64Data: base64String.split(",")[1],
        dataUrl: base64String,
        name: file.name
      };
      expandInput();
    };
    reader.readAsDataURL(file);
  } else if (isAudio || isPdf) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      imagePreview.classList.add("hidden");
      filePreviewBadge.classList.remove("hidden");
      filePreviewBadge.classList.add("flex");
      filePreviewContainer.classList.remove("hidden");
      filePreviewName.textContent = file.name;
      filePreviewIcon.className = isAudio ? "ph ph-speaker-simple-high text-lg text-indigo-500" : "ph ph-file-pdf text-lg text-rose-500";

      currentAttachedFile = {
        type: isAudio ? "audio" : "pdf",
        mimeType: file.type || (isPdf ? "application/pdf" : "audio/mp3"),
        base64Data: base64String.split(",")[1],
        dataUrl: null,
        name: file.name
      };
      expandInput();
    };
    reader.readAsDataURL(file);
  } else if (isText) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const textContent = reader.result;
      imagePreview.classList.add("hidden");
      filePreviewBadge.classList.remove("hidden");
      filePreviewBadge.classList.add("flex");
      filePreviewContainer.classList.remove("hidden");
      filePreviewName.textContent = file.name;
      filePreviewIcon.className = "ph ph-file-code text-lg text-indigo-500";

      currentAttachedFile = {
        type: "text",
        textContent: textContent,
        name: file.name
      };
      expandInput();
    };
    reader.readAsText(file);
  } else {
    alert("Unsupported file format. Please attach images, audio, PDF, or code/text files.");
  }
}

if (fileUpload) {
  fileUpload.addEventListener("change", (e) => {
    handleSelectedFile(e.target.files[0]);
  });
}

// Drag-and-Drop Anywhere Overlay Handlers
let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragDropOverlay && e.dataTransfer && e.dataTransfer.types.includes("Files")) {
    dragDropOverlay.classList.remove("hidden");
    dragDropOverlay.classList.add("flex");
  }
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0 && dragDropOverlay) {
    dragCounter = 0;
    dragDropOverlay.classList.add("hidden");
    dragDropOverlay.classList.remove("flex");
  }
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dragDropOverlay) {
    dragDropOverlay.classList.add("hidden");
    dragDropOverlay.classList.remove("flex");
  }
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleSelectedFile(e.dataTransfer.files[0]);
  }
});

// Custom System Instructions Persistence
if (customInstructionsInput) {
  customInstructionsInput.value = localStorage.getItem("dexter_custom_instructions") || "";
  customInstructionsInput.addEventListener("input", (e) => {
    localStorage.setItem("dexter_custom_instructions", e.target.value);
  });
}

// Text-to-Speech Customizer (Voices & Speed)
function populateTtsVoices() {
  if (!window.speechSynthesis || !ttsVoiceSelect) return;
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;
  const savedVoice = localStorage.getItem("dexter_tts_voice") || "";
  ttsVoiceSelect.innerHTML = '<option value="">Default System Voice</option>';
  voices.forEach(voice => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === savedVoice) option.selected = true;
    ttsVoiceSelect.appendChild(option);
  });
}

if (window.speechSynthesis) {
  populateTtsVoices();
  speechSynthesis.onvoiceschanged = populateTtsVoices;
}

if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener("change", (e) => {
    localStorage.setItem("dexter_tts_voice", e.target.value);
  });
}

if (ttsSpeedSlider && ttsSpeedVal) {
  const savedSpeed = localStorage.getItem("dexter_tts_speed") || "1.0";
  ttsSpeedSlider.value = savedSpeed;
  ttsSpeedVal.textContent = `${parseFloat(savedSpeed).toFixed(1)}x`;
  ttsSpeedSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    ttsSpeedVal.textContent = `${val}x`;
    localStorage.setItem("dexter_tts_speed", val);
  });
}

if (testVoiceBtn) {
  testVoiceBtn.addEventListener("click", () => {
    speakText("Hello! I am Dexter, your intelligent workspace companion.");
  });
}

// Keyboard Shortcuts Modal Toggle
function toggleShortcutsModal() {
  if (!shortcutsModal) return;
  if (shortcutsModal.classList.contains("hidden")) {
    shortcutsModal.classList.remove("hidden");
    shortcutsModal.classList.add("flex");
  } else {
    shortcutsModal.classList.add("hidden");
    shortcutsModal.classList.remove("flex");
  }
}

if (shortcutsBtn) shortcutsBtn.addEventListener("click", toggleShortcutsModal);
if (closeShortcutsBtn) closeShortcutsBtn.addEventListener("click", toggleShortcutsModal);
shortcutsModal?.querySelector(".shortcuts-backdrop")?.addEventListener("click", toggleShortcutsModal);

// Rename Session Modal Handlers
function openRenameModal(sessionId, currentTitle) {
  activeRenamingSessionId = sessionId;
  if (renameInput) renameInput.value = currentTitle || "";
  if (renameModal) {
    renameModal.classList.remove("hidden");
    renameModal.classList.add("flex");
    setTimeout(() => renameInput?.focus(), 50);
  }
}

function closeRenameModal() {
  activeRenamingSessionId = null;
  if (renameModal) {
    renameModal.classList.add("hidden");
    renameModal.classList.remove("flex");
  }
}

if (closeRenameBtn) closeRenameBtn.addEventListener("click", closeRenameModal);
if (cancelRenameBtn) cancelRenameBtn.addEventListener("click", closeRenameModal);
renameModal?.querySelector(".rename-backdrop")?.addEventListener("click", closeRenameModal);

if (renameForm) {
  renameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeRenamingSessionId || !renameInput) return;
    const newTitle = renameInput.value.trim();
    if (newTitle) {
      try {
        await updateDoc(doc(db, "sessions", activeRenamingSessionId), {
          title: newTitle
        });
      } catch (err) {
        console.error("Error renaming chat session:", err);
      }
    }
    closeRenameModal();
  });
}

if (removeFileBtn) {
  removeFileBtn.addEventListener("click", clearAttachedFile);
}

function clearAttachedFile() {
  if (fileUpload) fileUpload.value = "";
  imagePreview.src = "";
  imagePreview.classList.add("hidden");
  filePreviewBadge.classList.add("hidden");
  filePreviewBadge.classList.remove("flex");
  filePreviewContainer.classList.add("hidden");
  currentAttachedFile = null;
}


const COMMAND_PREFIXES = {
  "/image": "/image ",
  "/summarize": "Summarize this clearly with key takeaways: ",
  "/fix": "Analyze, debug, and fix any errors or bottlenecks in this code: ",
  "/explain": "Explain this concept in simple terms with everyday analogies: ",
  "/refactor": "Refactor and optimize this code according to clean code best practices: ",
  "/test": "Write comprehensive unit test cases and edge tests for: ",
  "/translate": "Translate this text accurately into English: "
};

// Image Generator Direct Button in Command Deck Capsule
const imageGenBtn = document.getElementById("image-gen-btn");
if (imageGenBtn) {
  imageGenBtn.addEventListener("click", () => {
    expandInput();
    if (!messageInput.value.startsWith("/image ")) {
      messageInput.value = "/image " + messageInput.value.replace(/^\/image\s*/, "");
    }
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  });
}

// Quick HUD Command Chips on Welcome Screen
document.querySelectorAll(".quick-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const fill = chip.dataset.fill || "";
    expandInput();
    messageInput.value = fill;
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  });
});

function updateSlashCommandsMenu() {
  if (!slashCommandsMenu) return;
  const val = messageInput.value;
  if (val.startsWith("/") && !val.includes(" ")) {
    const query = val.toLowerCase();
    const items = slashCommandsMenu.querySelectorAll(".slash-item");
    let visibleCount = 0;
    items.forEach(item => {
      const cmd = item.dataset.cmd.toLowerCase();
      if (cmd.startsWith(query)) {
        item.classList.remove("hidden");
        visibleCount++;
      } else {
        item.classList.add("hidden");
      }
    });
    if (visibleCount > 0) {
      slashCommandsMenu.classList.remove("hidden");
    } else {
      slashCommandsMenu.classList.add("hidden");
    }
  } else {
    slashCommandsMenu.classList.add("hidden");
  }
}

messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if(this.value === '') this.style.height = 'auto';
  updateSlashCommandsMenu();
});

document.querySelectorAll(".slash-item").forEach(item => {
  item.addEventListener("click", () => {
    const cmd = item.dataset.cmd;
    const prefix = COMMAND_PREFIXES[cmd] || (cmd + " ");
    messageInput.value = prefix;
    if (slashCommandsMenu) slashCommandsMenu.classList.add("hidden");
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  });
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled && (messageInput.value.trim() || currentAttachedFile)) {
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }
});

function collapseInput() {
  chatForm.classList.add("hidden");
  if (disclaimerText) disclaimerText.classList.add("hidden");
  if (collapsedInputPill) {
    collapsedInputPill.classList.remove("hidden");
    collapsedInputPill.classList.add("flex");
  }
}

function expandInput() {
  if (collapsedInputPill) {
    collapsedInputPill.classList.add("hidden");
    collapsedInputPill.classList.remove("flex");
  }
  chatForm.classList.remove("hidden");
  if (disclaimerText) disclaimerText.classList.remove("hidden");
  messageInput.focus();
}

if (collapseInputBtn) {
  collapseInputBtn.addEventListener("click", collapseInput);
}

if (collapsedInputPill) {
  collapsedInputPill.addEventListener("click", expandInput);
}

window.addEventListener("keydown", (e) => {
  const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (chatForm.classList.contains("hidden")) {
      expandInput();
    } else {
      collapseInput();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleSidebar();
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    toggleStudioCanvas();
  }

  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    toggleShortcutsModal();
  }

  if (e.key === '?' && !isInputFocused) {
    e.preventDefault();
    toggleShortcutsModal();
  }

  if (e.key === "Escape") {
    if (rightCanvasPanel && !rightCanvasPanel.classList.contains("collapsed") && window.innerWidth < 1024) {
      toggleStudioCanvas(false);
      return;
    }
    if (sidebar && sidebar.classList.contains("drawer-open") && !isDesktop()) {
      toggleSidebar(false);
      return;
    }
    if (shortcutsModal && !shortcutsModal.classList.contains("hidden")) {
      toggleShortcutsModal();
      return;
    }
    if (renameModal && !renameModal.classList.contains("hidden")) {
      closeRenameModal();
      return;
    }
    if (sandboxModal && !sandboxModal.classList.contains("hidden")) {
      closeSandbox();
      return;
    }
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
      toggleSettings();
      return;
    }
    if (slashCommandsMenu && !slashCommandsMenu.classList.contains("hidden")) {
      slashCommandsMenu.classList.add("hidden");
      return;
    }
    if (document.activeElement === messageInput && !messageInput.value) {
      collapseInput();
    }
  }
});

function hideWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = 'none';
}

let lastMessageRole = null;

function appendMessage(role, text, fileInfo = null) {
  hideWelcomeScreen();
  
  const msgDiv = document.createElement("div");
  const isGrouped = lastMessageRole === role;
  const mtClass = isGrouped ? "mt-2" : "mt-6";
  msgDiv.className = `flex w-full message-fade-enter ${role === 'user' ? 'justify-end' : 'justify-start'} ${mtClass}`;
  
  const innerBubble = document.createElement("div");
  let contentElement = innerBubble;
  
  if (role === 'user') {
    innerBubble.className = `w-fit max-w-[85%] sm:max-w-[75%] rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3.5 shadow-md shadow-indigo-500/15 text-[15px] leading-relaxed whitespace-pre-wrap ${isGrouped ? 'rounded-tr-xl' : 'rounded-tr-sm'}`;
    
    // Display attached file or image
    if (fileInfo) {
      const isImg = (typeof fileInfo === 'string' && (fileInfo.startsWith('data:image') || fileInfo.startsWith('http'))) || 
                    (fileInfo && fileInfo.type === 'image');
      if (isImg) {
        const imgContainer = document.createElement("div");
        imgContainer.className = "mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10 max-w-sm shadow-sm";
        const imgEl = document.createElement("img");
        imgEl.src = typeof fileInfo === 'string' ? fileInfo : (fileInfo.dataUrl || "");
        imgEl.alt = "Uploaded image";
        imgEl.className = "max-h-64 w-auto rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity";
        imgEl.onclick = () => window.open(imgEl.src, '_blank');
        imgContainer.appendChild(imgEl);
        innerBubble.appendChild(imgContainer);
      } else {
        const fileBadge = document.createElement("div");
        fileBadge.className = "mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-medium w-fit";
        const type = typeof fileInfo === 'object' ? fileInfo.type : 'file';
        const name = typeof fileInfo === 'object' ? fileInfo.name : 'Attached file';
        const iconName = type === 'audio' ? 'ph-speaker-simple-high' : (type === 'pdf' ? 'ph-file-pdf' : 'ph-file-code');
        fileBadge.innerHTML = `<i class="ph ${iconName} text-base"></i> <span class="truncate max-w-[200px]">${name}</span>`;
        innerBubble.appendChild(fileBadge);
      }
    }

    if (text && text !== "[Image attached]" && text !== "[File attached]") {
      const textDiv = document.createElement("div");
      textDiv.textContent = text;
      innerBubble.appendChild(textDiv);
    }
    
    msgDiv.appendChild(innerBubble);
  } else {
    // Dexter Message - Frameless and clean, just like ChatGPT/Claude
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "flex gap-2.5 sm:gap-3.5 w-full min-w-0";
    
    // Avatar
    const avatar = document.createElement("div");
    avatar.className = `w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden flex-shrink-0 mt-0.5 shadow-sm ring-1 ring-border/80 ${isGrouped ? 'invisible' : ''}`;
    avatar.innerHTML = '<img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />';
    
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex flex-col gap-1 w-full min-w-0";

    innerBubble.className = "w-full text-foreground markdown-body overflow-x-auto leading-relaxed text-[15px] pt-0.5";
    contentElement = innerBubble;

    // Message Action Buttons with Text-to-Speech
    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-1 mt-1 ml-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 translate-y-0 sm:translate-y-1 sm:group-hover:translate-y-0 flex-wrap";
    actionRow.innerHTML = `
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors tts-msg" title="Listen / Read Aloud">
        <i class="ph ph-speaker-high text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors copy-msg" title="Copy Message">
        <i class="ph ph-copy text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors regen-msg" title="Regenerate Response">
        <i class="ph ph-arrows-clockwise text-sm"></i>
      </button>
      <div class="h-3 w-px bg-border/60 mx-1"></div>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors" title="Good Response">
        <i class="ph ph-thumbs-up text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors" title="Bad Response">
        <i class="ph ph-thumbs-down text-sm"></i>
      </button>
    `;

    const typingDotsHtml = `
      <div class="typing-indicator flex items-center gap-1.5 py-1">
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
      </div>
    `;

    if (text) {
      innerBubble.dataset.rawText = text;
      innerBubble.innerHTML = marked.parse(text);
      postProcessContent(innerBubble);
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      if (words > 0) {
        const readMins = Math.max(1, Math.ceil(words / 200));
        const badge = document.createElement("span");
        badge.className = "stats-badge text-[10px] text-muted-foreground/60 font-mono px-2 py-0.5 rounded-full bg-secondary/50 border border-border/40 select-none ml-1.5 flex items-center gap-1";
        badge.innerHTML = `<i class="ph ph-article text-xs"></i> <span>${words} words</span> · <span>~${readMins}m read</span>`;
        actionRow.appendChild(badge);
      }
    } else {
      innerBubble.innerHTML = typingDotsHtml;
    }
    
    actionRow.querySelector('.tts-msg').addEventListener('click', function() {
      speakText(innerBubble.dataset.rawText || text || "", this);
    });

    actionRow.querySelector('.copy-msg').addEventListener('click', () => {
      navigator.clipboard.writeText(innerBubble.dataset.rawText || text || "");
    });

    actionRow.querySelector('.regen-msg').addEventListener('click', () => {
      if (lastUserMessage || lastUserFile) {
        msgDiv.remove();
        lastMessageRole = null;
        chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    contentWrapper.appendChild(innerBubble);
    contentWrapper.appendChild(actionRow);

    wrapperDiv.appendChild(avatar);
    wrapperDiv.appendChild(contentWrapper);
    wrapperDiv.classList.add("group"); 
    msgDiv.appendChild(wrapperDiv);
  }
  
  messagesArea.appendChild(msgDiv);
  scrollToBottom();
  
  lastMessageRole = role;

  return {
    element: contentElement,
    msgDiv: msgDiv,
    updateText: (newText) => {
      contentElement.dataset.rawText = newText;
      contentElement.innerHTML = marked.parse(newText) + `
        <div class="mt-2 text-cyan-400">
          <div class="typing-indicator flex items-center gap-1.5 py-1">
            <span class="w-2 h-2 bg-cyan-400 rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-cyan-400 rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-cyan-400 rounded-full typing-dot inline-block"></span>
          </div>
        </div>
      `;
      scrollToBottom();
    },
    finalize: () => {
      const rawText = contentElement.dataset.rawText || "";
      contentElement.innerHTML = marked.parse(rawText);
      postProcessContent(contentElement);

      // Append Response Stats Metric Badge
      const words = rawText.trim() ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;
      if (words > 0) {
        const readMins = Math.max(1, Math.ceil(words / 200));
        const actionRow = contentElement.parentElement?.querySelector(".opacity-0") || contentElement.nextElementSibling;
        if (actionRow) {
          let badge = actionRow.querySelector(".stats-badge");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "stats-badge text-[10px] text-muted-foreground/60 font-mono px-2 py-0.5 rounded-full bg-secondary/50 border border-border/40 select-none ml-1.5 flex items-center gap-1";
            actionRow.appendChild(badge);
          }
          badge.innerHTML = `<i class="ph ph-article text-xs"></i> <span>${words} words</span> · <span>~${readMins}m read</span>`;
        }
      }

      scrollToBottom();
    }
  };
}

// KaTeX Math Renderer Helper
function renderKaTeX(element) {
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn("KaTeX render error:", err);
    }
  }
}

// Mermaid Diagram Renderer Helper
function renderMermaid(element) {
  if (!window.mermaid) return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
      securityLevel: "loose"
    });
    const mermaidCodeBlocks = element.querySelectorAll("pre code.language-mermaid");
    if (mermaidCodeBlocks.length === 0) return;
    mermaidCodeBlocks.forEach((codeEl, idx) => {
      const pre = codeEl.closest("pre");
      const rawCode = codeEl.innerText.trim();
      const container = document.createElement("div");
      container.className = "mermaid flex justify-center overflow-x-auto my-3 p-3 rounded-xl bg-secondary/40 border border-border/50";
      container.id = `mermaid-chart-${Date.now()}-${idx}`;
      container.textContent = rawCode;
      if (pre && pre.parentNode) {
        pre.parentNode.replaceChild(container, pre);
      }
    });
    mermaid.run({
      nodes: element.querySelectorAll(".mermaid")
    }).catch(err => {
      console.warn("Mermaid execution error:", err);
    });
  } catch (e) {
    console.warn("Mermaid error:", e);
  }
}

// Text-to-Speech Helper with Customized Voice, Rate, and Reactive Motion
function speakText(rawText, btn = null) {
  if (!window.speechSynthesis) {
    alert("Speech synthesis is not supported in this browser.");
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    stopRealAudioVisualizer();
    if (btn && btn.dataset.speaking === "true") {
      btn.dataset.speaking = "false";
      btn.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
      return;
    }
  }
  document.querySelectorAll('.tts-msg').forEach(b => {
    b.dataset.speaking = "false";
    b.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
  });

  const clean = rawText
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*#_~\[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();

  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  window._dexterTtsUtterance = utterance;
  const savedVoiceUri = localStorage.getItem("dexter_tts_voice");
  if (savedVoiceUri) {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.voiceURI === savedVoiceUri);
    if (voice) utterance.voice = voice;
  }
  const savedRate = parseFloat(localStorage.getItem("dexter_tts_speed") || "1.0");
  utterance.rate = isNaN(savedRate) ? 1.0 : savedRate;

  // Real-time reactive motion activation
  if (jarvisWaveform) jarvisWaveform.classList.add("speaking");
  if (neuralCoreHero) {
    neuralCoreHero.classList.add("speaking");
    neuralCoreHero.classList.add("thinking");
  }
  startRealAudioVisualizer();

  utterance.onboundary = (e) => {
    if (neuralCoreHero && !neuralCoreHero.classList.contains("beat-punch")) {
      neuralCoreHero.classList.add("beat-punch");
      setTimeout(() => neuralCoreHero.classList.remove("beat-punch"), 110);
    }
  };

  const cleanupSpeak = () => {
    if (btn) {
      btn.dataset.speaking = "false";
      btn.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
    }
    stopRealAudioVisualizer();
    window._dexterTtsUtterance = null;
  };

  if (btn) {
    btn.dataset.speaking = "true";
    btn.innerHTML = '<i class="ph ph-stop-circle text-sm text-cyan-400 animate-pulse"></i>';
  }

  utterance.onend = cleanupSpeak;
  utterance.onerror = (err) => {
    console.warn("TTS error:", err);
    cleanupSpeak();
  };

  speechSynthesis.speak(utterance);
}

// ==========================================
// FLUX.1 NEURAL IMAGE ENGINE (POLLINATIONS.AI)
// ==========================================
function extractImagePrompt(text) {
  if (!text) return null;
  const trimmed = text.trim();
  
  if (trimmed.toLowerCase().startsWith("/image")) {
    const after = trimmed.substring(6).trim();
    return after || "Futuristic holographic AI neural core, octane render, 8k";
  }

  const regex = /^(?:please\s+)?(?:generate|create|make|draw|paint|render|produce)\s+(?:an?\s+)?(?:image|photo|picture|artwork|illustration|wallpaper|portrait|drawing)\s+(?:of|for|showing|depicting)\s+(.+)/i;
  const match = trimmed.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

function renderFluxImageCard(container, prompt, imageUrl, initialSeed) {
  let currentSeed = initialSeed || Math.floor(Math.random() * 9999999);
  let currentUrl = imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${currentSeed}`;

  container.innerHTML = `
    <div class="ai-image-card">
      <div class="px-3.5 py-2 bg-secondary/50 border-b border-border/40 flex items-center justify-between text-xs">
        <span class="flex items-center gap-1.5 font-bold text-pink-500">
          <i class="ph-bold ph-paint-brush-broad"></i> FLUX.1 Neural Synthesis
        </span>
        <span class="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/40">1024 × 1024 · Ultra-HD</span>
      </div>
      <div class="relative min-h-[260px] sm:min-h-[340px] flex items-center justify-center bg-black/10 overflow-hidden group">
        <div class="image-spinner flex flex-col items-center gap-2.5 p-6 text-center">
          <div class="relative w-10 h-10 flex items-center justify-center">
            <span class="absolute inset-0 rounded-full border-2 border-pink-500/30 animate-ping"></span>
            <i class="ph-bold ph-spinner animate-spin text-2xl text-pink-500"></i>
          </div>
          <span class="text-xs text-muted-foreground font-medium animate-pulse">Rendering neural diffusion latent frames...</span>
        </div>
        <img src="${currentUrl}" alt="${prompt}" class="hidden w-full h-auto object-cover transition-all duration-500 cursor-pointer hover:scale-[1.01]" />
      </div>
      <div class="ai-image-card-bar">
        <div class="min-w-0 pr-2">
          <p class="text-[11px] text-muted-foreground truncate max-w-[180px] xs:max-w-xs italic font-medium">"${prompt}"</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <a href="${currentUrl}" target="_blank" download="dexter-flux-${currentSeed}.jpg" class="download-img-btn p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center gap-1" title="Download High-Res (1024px)">
            <i class="ph-bold ph-download-simple text-sm"></i>
          </a>
          <button class="regen-flux-btn p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center gap-1" title="Generate New Variation">
            <i class="ph-bold ph-arrows-clockwise text-sm"></i>
          </button>
          <button class="copy-flux-url p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center gap-1" title="Copy Image URL">
            <i class="ph-bold ph-link text-sm"></i>
          </button>
          <button class="expand-flux-btn p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center gap-1" title="Fullscreen Preview">
            <i class="ph-bold ph-arrows-out text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const card = container.querySelector(".ai-image-card");
  if (!card) return;
  const img = card.querySelector("img");
  const spinner = card.querySelector(".image-spinner");
  const downloadBtn = card.querySelector(".download-img-btn");
  const regenBtn = card.querySelector(".regen-flux-btn");
  const copyBtn = card.querySelector(".copy-flux-url");
  const expandBtn = card.querySelector(".expand-flux-btn");

  img.onload = () => {
    spinner.classList.add("hidden");
    img.classList.remove("hidden");
    img.classList.add("animate-in", "fade-in", "duration-500");
    scrollToBottom();
  };
  img.onerror = () => {
    spinner.innerHTML = '<span class="text-xs text-rose-500 font-medium">Image generation timed out. Click regenerate to retry.</span>';
  };
  img.onclick = () => window.open(img.src, '_blank');

  regenBtn?.addEventListener("click", () => {
    currentSeed = Math.floor(Math.random() * 9999999);
    currentUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${currentSeed}`;
    spinner.classList.remove("hidden");
    img.classList.add("hidden");
    img.src = currentUrl;
    if (downloadBtn) {
      downloadBtn.href = currentUrl;
      downloadBtn.download = `dexter-flux-${currentSeed}.jpg`;
    }
    updateStudioCanvasImage(prompt, currentSeed);
  });

  copyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(currentUrl);
    copyBtn.innerHTML = '<i class="ph-bold ph-check text-green-500 text-sm"></i>';
    setTimeout(() => {
      copyBtn.innerHTML = '<i class="ph-bold ph-link text-sm"></i>';
    }, 2000);
  });

  expandBtn?.addEventListener("click", () => {
    window.open(currentUrl, '_blank');
  });

  // Automatically sync to Right Studio Canvas
  updateStudioCanvasImage(prompt, currentSeed);
}

function postProcessContent(element) {
  // 1. Process Pollinations / FLUX AI Images in Markdown
  element.querySelectorAll('img').forEach((img) => {
    if (img.closest('.ai-image-card') || img.closest('#file-preview-container') || (img.src && img.src.includes('logo.jpg'))) return;
    if (img.src && (img.src.includes('pollinations.ai') || img.alt.includes('FLUX'))) {
      const promptText = img.alt || "AI Artwork";
      const wrapper = document.createElement("div");
      if (img.parentNode) {
        img.parentNode.replaceChild(wrapper, img);
        renderFluxImageCard(wrapper, promptText, img.src);
      }
    }
  });

  // 2. Syntax Highlighting & Futuristic IDE Terminal Window
  element.querySelectorAll('pre code').forEach((block) => {
    if (block.classList.contains("language-mermaid")) return;
    hljs.highlightElement(block);
    const pre = block.parentElement;
    if (pre.dataset.processed === "true") return;
    pre.dataset.processed = "true";

    let lang = "code";
    const match = block.className.match(/language-(\w+)/);
    if (match) lang = match[1];

    const terminalWindow = document.createElement("div");
    terminalWindow.className = "terminal-window relative group";

    const header = document.createElement("div");
    header.className = "terminal-header";
    header.innerHTML = `
      <div class="flex items-center gap-2.5">
        <div class="terminal-dots">
          <span class="terminal-dot red"></span>
          <span class="terminal-dot yellow"></span>
          <span class="terminal-dot green"></span>
        </div>
        <span class="text-[11px] font-mono text-muted-foreground/80 tracking-wide uppercase px-2 py-0.5 rounded bg-white/5 border border-white/5 font-semibold">${lang}</span>
      </div>
      <div class="flex items-center gap-1.5 terminal-actions"></div>
    `;

    const actionsContainer = header.querySelector(".terminal-actions");

    const codeText = block.innerText;
    const isHtmlOrSvg = block.classList.contains("language-html") || 
                        block.classList.contains("language-xml") || 
                        block.classList.contains("language-svg") ||
                        codeText.includes("<!DOCTYPE html>") || 
                        codeText.includes("<html") || 
                        codeText.includes("<svg");

    if (isHtmlOrSvg) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "preview-btn bg-cyan-400 hover:bg-cyan-300 text-black px-2 py-1 rounded-md text-xs flex items-center gap-1 font-bold shadow-sm transition-all";
      previewBtn.innerHTML = '<i class="ph-bold ph-play"></i> Live Sandbox';
      previewBtn.onclick = () => {
        if (window.innerWidth >= 1024) {
          openInStudioSandbox(codeText);
        } else {
          openSandbox(codeText);
        }
      };
      actionsContainer.appendChild(previewBtn);
    }

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn bg-white/10 hover:bg-white/20 text-foreground px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-all border border-white/10";
    copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      copyBtn.innerHTML = '<i class="ph ph-check text-green-400"></i> Copied';
      setTimeout(() => copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy', 2000);
    };
    actionsContainer.appendChild(copyBtn);

    if (pre.parentNode) {
      pre.parentNode.insertBefore(terminalWindow, pre);
      terminalWindow.appendChild(header);
      terminalWindow.appendChild(pre);
      pre.style.margin = "0";
      pre.style.borderRadius = "0";
      pre.style.border = "none";
    }
  });

  // KaTeX rendering
  renderKaTeX(element);

  // Mermaid diagrams
  renderMermaid(element);
}

function scrollToBottom() {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: 'smooth'
  });
}

function showTypingIndicator() {
  hideWelcomeScreen();
  const div = document.createElement("div");
  div.id = "typing-indicator";
  div.className = "flex w-full justify-start animate-in fade-in duration-300";
  
  div.innerHTML = `
    <div class="flex gap-3.5 items-center">
      <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-border/80">
        <img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />
      </div>
      <div class="flex items-center gap-1.5 py-2">
        <div class="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-cyan-400 rounded-full typing-dot"></div>
      </div>
    </div>
  `;
  messagesArea.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const div = document.getElementById("typing-indicator");
  if (div) {
    div.remove();
  }
}

// Suggestion Buttons Logic
document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    let fullPrompt = btn.dataset.prompt;
    if (!fullPrompt) {
      const spans = btn.querySelectorAll('span');
      if (spans.length >= 3) {
        fullPrompt = `${spans[1].textContent.trim()} ${spans[2].textContent.trim()}`;
      } else if (spans.length >= 2) {
        fullPrompt = `${spans[0].textContent.trim()} ${spans[1].textContent.trim()}`;
      }
    }
    
    if (fullPrompt) {
      expandInput();
      messageInput.value = fullPrompt;
      messageInput.style.height = 'auto';
      messageInput.style.height = (messageInput.scrollHeight) + 'px';
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });
});

// ==========================================
// FIREBASE SESSIONS & HISTORY
// ==========================================
let currentSessionId = null;

function clearMessages() {
  lastMessageRole = null;
  activeSessionHistory = [];
  const children = Array.from(messagesArea.children);
  children.forEach(child => {
    if (child.id !== "welcome-screen") {
      child.remove();
    }
  });
  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = 'flex';
}

function updateActiveSidebarClass() {
  const historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  const items = historyList.querySelectorAll("[data-session-id]");
  items.forEach(item => {
    const isCurrent = item.dataset.sessionId === currentSessionId;
    if (isCurrent) {
      item.classList.add("bg-secondary", "text-foreground", "shadow-sm", "border-border/80");
      item.classList.remove("text-muted-foreground", "border-transparent");
    } else {
      item.classList.remove("bg-secondary", "text-foreground", "shadow-sm", "border-border/80");
      item.classList.add("text-muted-foreground", "border-transparent");
    }
  });
}

async function createNewSession(firstMessageText) {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
  }
  const cleanTitle = (firstMessageText || "New Chat").replace(/[\r\n]+/g, " ").trim();
  const title = cleanTitle.length > 28 ? cleanTitle.substring(0, 28) + "..." : cleanTitle;
  const effectiveUserId = currentUser ? currentUser.uid : getGuestId();
  try {
    await setDoc(doc(db, "sessions", currentSessionId), {
      title: title || "New Chat",
      createdAt: serverTimestamp(),
      isPinned: false,
      userId: effectiveUserId
    });
  } catch (error) {
    console.error("Error creating session:", error);
  }
}

async function saveMessageToFirestore(role, message, image = null) {
  if (!currentSessionId) {
    await createNewSession(message || "Image Query");
  }
  try {
    const docData = {
      role: role,
      message: message || "",
      timestamp: serverTimestamp()
    };
    if (image && image.length < 800000) {
      docData.image = image;
    }
    await addDoc(collection(db, "sessions", currentSessionId, "messages"), docData);
  } catch (error) {
    console.warn("Error saving message: ", error);
  }
}

async function loadChatHistory(sessionId) {
  clearMessages();
  currentSessionId = sessionId;
  updateActiveSidebarClass();
  activeSessionHistory = [];
  try {
    const q = collection(db, "sessions", sessionId, "messages");
    const querySnapshot = await getDocs(q);
    const docsList = [];
    querySnapshot.forEach((docSnap) => {
      docsList.push({ id: docSnap.id, ...docSnap.data() });
    });

    docsList.sort((a, b) => {
      const getMs = (t) => {
        if (!t) return 0;
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (t.seconds) return t.seconds * 1000;
        return new Date(t).getTime() || 0;
      };
      return getMs(a.timestamp) - getMs(b.timestamp);
    });

    docsList.forEach((data) => {
      appendMessage(data.role || 'dexter', data.message, data.image);
      if (data.message) {
        activeSessionHistory.push({
          role: data.role === 'dexter' ? 'model' : 'user',
          parts: [{ text: data.message }]
        });
      }
    });
  } catch (error) {
    console.error("Error loading chat history: ", error);
  }
}

function renderSidebarSessions(querySnapshot) {
  const historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  historyList.innerHTML = '';
  
  if (querySnapshot.empty) {
    historyList.innerHTML = `
      <div class="text-[11px] font-bold text-muted-foreground/70 px-2.5 py-2 uppercase tracking-wider">Recent</div>
      <div class="text-xs text-muted-foreground/60 px-3 py-3 italic">No previous chats</div>
    `;
    return;
  }
  
  const pinnedSessions = [];
  const recentSessions = [];

  querySnapshot.forEach((docSnap) => {
    const session = docSnap.data();
    session.id = docSnap.id;
    if (session.isPinned) {
      pinnedSessions.push(session);
    } else {
      recentSessions.push(session);
    }
  });

  const getMs = (t) => {
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return new Date(t).getTime() || 0;
  };
  pinnedSessions.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
  recentSessions.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));

  function createSessionItem(session) {
    const sessionId = session.id;
    const isCurrent = currentSessionId === sessionId;
    
    const container = document.createElement("div");
    container.dataset.sessionId = sessionId;
    container.className = `session-item group flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${isCurrent ? 'bg-secondary text-foreground shadow-sm border-border/80' : 'text-muted-foreground border-transparent hover:bg-secondary/60 hover:text-foreground'}`;
    
    const titleBtn = document.createElement("button");
    titleBtn.className = "flex-1 text-left truncate flex items-center gap-2 py-1 min-w-0";
    titleBtn.innerHTML = `<i class="ph ph-chat-circle text-muted-foreground flex-shrink-0 text-base"></i><span class="truncate">${session.title || "New Chat"}</span>`;
    titleBtn.addEventListener("click", () => {
      if (currentSessionId !== sessionId) {
        loadChatHistory(sessionId);
      }
      if (window.innerWidth < 768) toggleSidebar();
    });
    
    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "flex items-center gap-0.5 ml-1 flex-shrink-0";

    // Pin Button
    const pinBtn = document.createElement("button");
    pinBtn.className = `p-1 rounded-lg hover:bg-secondary/80 ${session.isPinned ? 'text-amber-500 opacity-100' : 'text-muted-foreground opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-500'} transition-all`;
    pinBtn.title = session.isPinned ? "Unpin chat" : "Pin to top";
    pinBtn.innerHTML = `<i class="${session.isPinned ? 'ph-fill ph-star' : 'ph ph-star'} text-xs"></i>`;
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await updateDoc(doc(db, "sessions", sessionId), {
          isPinned: !session.isPinned
        });
      } catch (err) {
        console.error("Error toggling pin:", err);
      }
    });

    // Rename Button
    const renameBtn = document.createElement("button");
    renameBtn.className = "opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-foreground hover:bg-secondary/80 p-1 rounded-lg transition-all text-muted-foreground";
    renameBtn.title = "Rename Chat";
    renameBtn.innerHTML = '<i class="ph ph-pencil-simple text-xs"></i>';
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModal(sessionId, session.title || "New Chat");
    });

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-all text-muted-foreground";
    deleteBtn.title = "Delete Chat";
    deleteBtn.innerHTML = '<i class="ph ph-trash text-xs"></i>';
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${session.title || "this chat"}"?`)) {
        try {
          await deleteDoc(doc(db, "sessions", sessionId));
          if (currentSessionId === sessionId) {
            currentSessionId = null;
            clearMessages();
          }
        } catch (err) {
          console.error("Error deleting session:", err);
        }
      }
    });

    actionsWrapper.appendChild(pinBtn);
    actionsWrapper.appendChild(renameBtn);
    actionsWrapper.appendChild(deleteBtn);

    container.appendChild(titleBtn);
    container.appendChild(actionsWrapper);
    return container;
  }

  // Render Pinned section if any
  if (pinnedSessions.length > 0) {
    const pinnedHeader = document.createElement("div");
    pinnedHeader.className = "text-[11px] font-bold text-amber-500/90 px-2.5 py-1.5 uppercase tracking-wider flex items-center gap-1.5";
    pinnedHeader.innerHTML = '<i class="ph-fill ph-star text-xs"></i> Pinned';
    historyList.appendChild(pinnedHeader);

    pinnedSessions.forEach(session => {
      historyList.appendChild(createSessionItem(session));
    });
  }

  // Render Recent section
  const recentHeader = document.createElement("div");
  recentHeader.className = `text-[11px] font-bold text-muted-foreground/70 px-2.5 py-1.5 uppercase tracking-wider ${pinnedSessions.length > 0 ? 'mt-2' : ''}`;
  recentHeader.textContent = "Recent";
  historyList.appendChild(recentHeader);

  if (recentSessions.length === 0 && pinnedSessions.length > 0) {
    const emptyRecent = document.createElement("div");
    emptyRecent.className = "text-xs text-muted-foreground/60 px-3 py-1.5 italic";
    emptyRecent.textContent = "All chats pinned";
    historyList.appendChild(emptyRecent);
  } else {
    recentSessions.forEach(session => {
      historyList.appendChild(createSessionItem(session));
    });
  }
}

function initSidebarSessionsListener() {
  if (sessionsUnsubscribe) {
    sessionsUnsubscribe();
    sessionsUnsubscribe = null;
  }

  const effectiveUserId = currentUser ? currentUser.uid : getGuestId();

  try {
    const q = query(
      collection(db, "sessions"), 
      where("userId", "==", effectiveUserId)
    );
    sessionsUnsubscribe = onSnapshot(q, (snapshot) => {
      renderSidebarSessions(snapshot);
      dismissLoadingScreen();
    }, (error) => {
      console.warn("Real-time sessions listener error:", error);
      dismissLoadingScreen();
    });
  } catch (error) {
    console.warn("Error setting up sessions listener:", error);
    dismissLoadingScreen();
  }
}

function dismissLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen && !loadingScreen.classList.contains("fade-out")) {
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
      autoPlayVoiceOnOpen();
      setTimeout(() => {
        loadingScreen.remove();
        autoPlayVoiceOnOpen();
      }, 600);
    }, 350);
  } else {
    autoPlayVoiceOnOpen();
  }
}

const newChatBtn = document.getElementById("new-chat-btn");
if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    currentSessionId = null;
    clearMessages();
    updateActiveSidebarClass();
    if (window.innerWidth < 768) toggleSidebar();
  });
}

// ==========================================
// GEMINI API CALL WITH PERSONAS, SEARCH & MEMORY
// ==========================================
function getActiveModel() {
  let personaInstruction = PERSONAS[currentPersona] || PERSONAS.default;
  const customInstructions = localStorage.getItem("dexter_custom_instructions") || "";
  if (customInstructions.trim()) {
    personaInstruction += `\n\nUser Custom Preferences & Instructions:\n${customInstructions.trim()}`;
  }
  const config = {
    model: "gemini-2.5-flash",
    systemInstruction: personaInstruction
  };
  if (isWebSearchEnabled) {
    config.tools = [{ googleSearch: {} }];
  }
  return genAI.getGenerativeModel(config);
}

async function streamDexterResponse(prompt, attachedFile, uiUpdater) {
  const heroCore = document.getElementById("neural-core-hero");
  if (heroCore) heroCore.classList.add("thinking");

  if (!GEMINI_API_KEY) {
    if (heroCore) heroCore.classList.remove("thinking");
    const errorText = "**Configuration Error:** Gemini API key is missing. Please set `VITE_GEMINI_API_KEY` in your environment variables (or Vercel dashboard).";
    uiUpdater.updateText(errorText);
    uiUpdater.finalize();
    return errorText;
  }

  let activeModel = getActiveModel();

  try {
    let result;
    if (attachedFile) {
      if (attachedFile.base64Data && attachedFile.mimeType) {
        // Multimodal: image, audio, or PDF
        const filePart = {
          inlineData: {
            data: attachedFile.base64Data,
            mimeType: attachedFile.mimeType
          }
        };
        const promptToUse = prompt || `Please analyze this attached ${attachedFile.type}.`;
        try {
          result = await activeModel.generateContentStream([promptToUse, filePart]);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            console.warn("Retrying without search grounding:", callErr);
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream([promptToUse, filePart]);
          } else {
            throw callErr;
          }
        }
      } else if (attachedFile.textContent) {
        // Text / code / CSV / JSON document
        const fullPrompt = `Attached file "${attachedFile.name}":\n\`\`\`\n${attachedFile.textContent}\n\`\`\`\n\nUser request: ${prompt || "Please review or analyze this attached document."}`;
        try {
          result = await activeModel.generateContentStream(fullPrompt);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream(fullPrompt);
          } else {
            throw callErr;
          }
        }
      }
    } else {
      if (!prompt) {
        if (heroCore) heroCore.classList.remove("thinking");
        return "";
      }

      // Multi-turn conversation context
      let usedChatSession = false;
      if (activeSessionHistory.length > 0 && !isWebSearchEnabled) {
        try {
          const validHistory = [];
          let expectedRole = 'user';
          for (const turn of activeSessionHistory.slice(-8)) {
            if (turn.role === expectedRole && turn.parts?.[0]?.text) {
              validHistory.push(turn);
              expectedRole = expectedRole === 'user' ? 'model' : 'user';
            }
          }
          if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
            validHistory.pop();
          }

          if (validHistory.length >= 2) {
            const chatSession = activeModel.startChat({ history: validHistory });
            result = await chatSession.sendMessageStream(prompt);
            usedChatSession = true;
          }
        } catch (chatErr) {
          console.warn("Falling back from startChat to generateContentStream:", chatErr);
        }
      }

      if (!usedChatSession) {
        try {
          result = await activeModel.generateContentStream(prompt);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream(prompt);
          } else {
            throw callErr;
          }
        }
      }
    }
    
    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      uiUpdater.updateText(fullText);
    }
    
    uiUpdater.finalize();

    // Save into multi-turn memory
    if (prompt) {
      activeSessionHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }
    if (fullText) {
      activeSessionHistory.push({ role: 'model', parts: [{ text: fullText }] });
    }

    if (heroCore) heroCore.classList.remove("thinking");
    return fullText;
  } catch (error) {
    if (heroCore) heroCore.classList.remove("thinking");
    console.error("Error calling Gemini API: ", error);
    const errorText = `**Error:** ${error.message || error.toString()}`;
    uiUpdater.updateText(errorText);
    uiUpdater.finalize();
    return errorText;
  }
}

// ==========================================
// FORM SUBMISSION
// ==========================================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  let text = messageInput.value.trim();
  const fileToSubmit = currentAttachedFile;
  
  if (!text && !fileToSubmit && !lastUserMessage && !lastUserFile) return; 

  let displayMessage = text;
  let fileDataToDisplay = fileToSubmit;
  
  if (text || fileToSubmit) {
    appendMessage("user", displayMessage, fileDataToDisplay);
    saveMessageToFirestore("user", displayMessage, fileDataToDisplay ? (fileDataToDisplay.dataUrl || fileDataToDisplay.name) : null);
    lastUserMessage = text; 
    lastUserFile = fileToSubmit;
  } else {
    // Regenerating
    text = lastUserMessage;
    fileDataToDisplay = lastUserFile;
  }

  const promptText = text;
  
  messageInput.value = "";
  messageInput.style.height = 'auto';
  clearAttachedFile();
  sendButton.disabled = true;
  if (voiceButton) voiceButton.disabled = true;
  
  // Create an empty Dexter message bubble with waving typing dots!
  const updater = appendMessage("dexter", null);
  
  // Intercept FLUX.1 AI Image Generation requests
  const imagePrompt = extractImagePrompt(promptText);
  if (imagePrompt && !fileDataToDisplay) {
    const heroCore = document.getElementById("neural-core-hero");
    if (heroCore) heroCore.classList.add("thinking");

    const seed = Math.floor(Math.random() * 9999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

    renderFluxImageCard(updater.element, imagePrompt, imageUrl, seed);
    
    if (heroCore) {
      setTimeout(() => heroCore.classList.remove("thinking"), 1800);
    }

    const savedMessage = `Here is your generated FLUX.1 AI artwork for **"${imagePrompt}"**:\n\n![${imagePrompt}](${imageUrl})`;
    updater.element.dataset.rawText = savedMessage;
    
    saveMessageToFirestore("dexter", savedMessage);
    activeSessionHistory.push({ role: 'user', parts: [{ text: promptText }] });
    activeSessionHistory.push({ role: 'model', parts: [{ text: savedMessage }] });

    sendButton.disabled = false;
    if (voiceButton) voiceButton.disabled = false;
    return;
  }

  const aiResponse = await streamDexterResponse(promptText, fileDataToDisplay, updater);
  
  saveMessageToFirestore("dexter", aiResponse);
  
  sendButton.disabled = false;
  if (voiceButton) voiceButton.disabled = false;
});


window.addEventListener("DOMContentLoaded", () => {
  initSidebarSessionsListener();
  
  setTimeout(() => {
    dismissLoadingScreen();
  }, 1600);
});
