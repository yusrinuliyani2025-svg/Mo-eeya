// Mo, eeya - Main Application Logic
let currentUser = null;
let currentTab = "dashboard";
let webcamStream = null;
let userCoords = { lat: 0.538120, lng: 122.261200, accuracy: 10 };
let activeAbsenType = "Masuk";
let targetAbsenUser = null; // for Absen Teman
let mapPicker = null;
let mapMarker = null;
let mapCircle = null;
let chartAttendance = null;
let chartWeekly = null;

// Sound Effects (Web Audio API)
function playChime(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (success) {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch(e) {}
}

// Distance Calculation (Haversine formula in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Avatar Icon / Photo Component Helper
function getAvatarBadge(foto, sizeClass = "w-9 h-9", iconSizeClass = "w-5 h-5") {
  if (foto && typeof foto === "string" && foto.trim() !== "" && !foto.includes("unsplash.com") && (foto.startsWith("data:image/") || foto.startsWith("http"))) {
    return `<img src="${foto}" class="${sizeClass} rounded-full object-cover border border-slate-200 shrink-0">`;
  }
  return `
    <div class="${sizeClass} rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shrink-0 shadow-2xs">
      <svg class="${iconSizeClass} text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
      </svg>
    </div>
  `;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initGeolocation();
  initCalendarWidget();
  
  // Check active session
  const savedUser = sessionStorage.getItem("mo_eeya_session");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    renderApp();
  } else {
    showLogin();
  }

  // Automatic Background Cloud Sync with Google Sheets
  DB.syncFromCloud(false).then(synced => {
    if (synced && currentUser) {
      if (currentTab === 'pegawai') renderPegawaiTable();
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'pengaturan') renderPengaturan();
    }
  });
});

// Realtime Clock
function initClock() {
  setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    document.querySelectorAll(".live-time-display").forEach(el => el.textContent = timeStr);
    document.querySelectorAll(".live-date-display").forEach(el => el.textContent = dateStr);
  }, 1000);
}

// Geolocation Tracking
function initGeolocation() {
  if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(
      pos => {
        userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        };
        updateLocationStatus();
      },
      err => {
        // Fallback default coordinates
        updateLocationStatus();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }
}

function updateLocationStatus() {
  const coordEls = document.querySelectorAll(".live-coord-display");
  coordEls.forEach(el => el.textContent = `${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)} (±${userCoords.accuracy}m)`);
  
  if (currentUser) {
    const offices = DB.getOffices();
    const office = offices.find(o => o.namaKantor === currentUser.namaKantor) || offices[0];
    if (office) {
      const dist = calculateDistance(userCoords.lat, userCoords.lng, parseFloat(office.lat), parseFloat(office.lng));
      const inRadius = dist <= office.radius;
      const statusEls = document.querySelectorAll(".live-radius-status");
      statusEls.forEach(el => {
        el.innerHTML = inRadius
          ? `<span class="inline-flex items-center text-emerald-600 font-bold"><svg class="w-4 h-4 mr-1 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg> Di Dalam Radius Kantor (${dist} meter / Batas ${office.radius}m)</span>`
          : `<span class="inline-flex items-center text-amber-600 font-bold"><svg class="w-4 h-4 mr-1 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg> Di Luar Radius Kantor (${dist} meter / Batas ${office.radius}m)</span>`;
      });
    }
  }
}

// Login & Auth
function showLogin() {
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("app-view").classList.add("hidden");
}

function quickFillLogin(role) {
  const users = DB.getUsers();
  let user = null;
  if (role === 'super_admin') {
    user = users.find(u => u.role === 'super_admin');
  } else if (role === 'admin_desa') {
    user = users.find(u => u.role === 'admin_desa');
  } else {
    user = users.find(u => u.role === 'user');
  }

  if (user) {
    document.getElementById("login-nik").value = user.nik;
    document.getElementById("login-password").value = user.password;
    
    // Highlight selected role tab
    document.querySelectorAll(".login-role-tab").forEach(tab => {
      tab.classList.remove("bg-white", "text-slate-900", "shadow");
      tab.classList.add("text-slate-400");
    });
    const targetTab = document.getElementById("tab-role-" + role);
    if (targetTab) {
      targetTab.classList.add("bg-white", "text-slate-900", "shadow");
      targetTab.classList.remove("text-slate-400");
    }
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const nik = document.getElementById("login-nik").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const users = DB.getUsers();

  const found = users.find(u => String(u.nik).trim() === nik && String(u.password).trim() === password);
  if (found) {
    currentUser = found;
    sessionStorage.setItem("mo_eeya_session", JSON.stringify(currentUser));
    playChime(true);
    Swal.fire({
      icon: 'success',
      title: `Selamat Datang!`,
      text: `${currentUser.nama} (${currentUser.jabatan})`,
      timer: 1500,
      showConfirmButton: false,
      timerProgressBar: true
    }).then(() => {
      renderApp();
    });
  } else {
    playChime(false);
    Swal.fire({
      icon: 'error',
      title: 'Login Gagal',
      text: 'NIK atau Password tidak cocok! Silakan cek kembali atau pilih akun demo di atas.',
      confirmButtonColor: '#0f172a'
    });
  }
}

function logout() {
  Swal.fire({
    title: 'Konfirmasi Keluar',
    text: 'Apakah Anda yakin ingin keluar dari sistem Mo\'eeya?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Keluar',
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      currentUser = null;
      sessionStorage.removeItem("mo_eeya_session");
      stopWebcam();
      showLogin();
    }
  });
}

// Render Application Based on Role
function renderApp() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("app-view").classList.remove("hidden");

  // Profile details in Topbar and Sidebar
  document.querySelectorAll(".user-name-display").forEach(el => el.textContent = currentUser.nama);
  document.querySelectorAll(".user-role-display").forEach(el => el.textContent = currentUser.jabatan);
  document.querySelectorAll(".user-office-display").forEach(el => el.textContent = currentUser.namaKantor);
  const avatarSrc = (currentUser.foto && currentUser.foto.trim() !== "") ? currentUser.foto : DEFAULT_AVATAR;
  document.querySelectorAll(".user-avatar-img").forEach(el => el.src = avatarSrc);
  
  // Tombol & Modal Database di Topbar: HANYA TAMPIL UNTUK SUPER ADMIN
  const btnDbStatus = document.getElementById("btn-db-status");
  if (btnDbStatus) {
    if (currentUser.role === "super_admin") {
      btnDbStatus.classList.remove("hidden");
      btnDbStatus.classList.add("inline-flex");
    } else {
      btnDbStatus.classList.add("hidden");
      btnDbStatus.classList.remove("inline-flex");
    }
  }

  // Set default tabs based on role
  buildNavigation();
  if (currentUser.role === "user") {
    switchTab("user-home");
  } else {
    switchTab("dashboard");
  }
  updateLocationStatus();
}

// Build Sidebar Navigation dynamically by Role
// Build Sidebar Navigation dynamically by Role
function buildNavigation() {
  const navContainer = document.getElementById("sidebar-menu-list");
  navContainer.innerHTML = "";

  let menuItems = [];

  // Hitung jumlah pengajuan izin/cuti/sakit yang masih berstatus 'Menunggu Persetujuan'
  const allLeaves = (typeof DB !== 'undefined' && DB.getLeaves) ? DB.getLeaves() : [];
  const pendingLeaves = allLeaves.filter(l => {
    const isPending = (l.status || "Menunggu Persetujuan") === "Menunggu Persetujuan";
    if (!isPending) return false;
    if (currentUser.role === "admin_desa") {
      return l.namaKantor === currentUser.namaKantor;
    }
    return true;
  });
  const pendingCount = pendingLeaves.length;

  if (currentUser.role === "user") {
    menuItems = [
      { id: "user-home", label: "Presensi & Menu", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { id: "user-history", label: "Riwayat Presensi", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
      { id: "user-peer", label: "Absensi Teman", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { id: "user-profile", label: "Profil Pegawai", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }
    ];
  } else if (currentUser.role === "admin_desa") {
    menuItems = [
      { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
      { id: "koreksi", label: "Koreksi Absen", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
      { id: "validasi-leave", label: "Validasi Izin & Cuti", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", badge: pendingCount },
      { id: "pegawai", label: "Tambah Pegawai", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { id: "user-peer", label: "Absensi Teman", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { id: "user-profile", label: "Profil Saya", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { id: "laporan", label: "Laporan", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }
    ];
  } else if (currentUser.role === "super_admin") {
    menuItems = [
      { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
      { id: "koreksi", label: "Koreksi Absen", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
      { id: "validasi-leave", label: "Validasi Izin & Cuti", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", badge: pendingCount },
      { id: "pegawai", label: "Tambah Pegawai", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
      { id: "user-peer", label: "Absensi Rekan", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
      { id: "pengaturan", label: "Pengaturan", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
      { id: "user-profile", label: "Profil Saya", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { id: "laporan", label: "Laporan", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }
    ];
  }

  menuItems.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.id = `nav-btn-${item.id}`;
    btn.onclick = () => switchTab(item.id);
    btn.className = `w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition duration-200 cursor-pointer ${index === 0 ? 'sidebar-pill-active' : 'sidebar-pill-inactive'}`;
    btn.innerHTML = `
      <div class="flex items-center space-x-3.5 truncate">
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"></path>
        </svg>
        <span class="truncate">${item.label}</span>
      </div>
      ${(item.badge && item.badge > 0) ? `<span class="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs animate-pulse">${item.badge}</span>` : ''}
    `;
    navContainer.appendChild(btn);
  });
}

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.add("hidden"));
  
  // Highlight active nav pill
  document.querySelectorAll("#sidebar-menu-list button").forEach(btn => {
    btn.classList.remove("sidebar-pill-active");
    btn.classList.add("sidebar-pill-inactive");
  });
  const activeBtn = document.getElementById(`nav-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add("sidebar-pill-active");
    activeBtn.classList.remove("sidebar-pill-inactive");
  }

  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) {
    targetPane.classList.remove("hidden");
  }

  // Load view-specific data
  if (tabId === "dashboard") {
    renderDashboard();
  } else if (tabId === "koreksi") {
    renderKoreksiTable();
  } else if (tabId === "validasi-leave") {
    renderValidasiLeave();
  } else if (tabId === "pegawai") {
    renderPegawaiTable();
  } else if (tabId === "pengaturan") {
    renderPengaturan();
  } else if (tabId === "laporan") {
    renderLaporanView();
  } else if (tabId === "user-home") {
    renderUserHome();
  } else if (tabId === "user-history") {
    renderUserHistory();
  } else if (tabId === "user-peer") {
    renderPeerSelection();
  } else if (tabId === "user-profile") {
    renderUserProfile();
  }

  // Close mobile sidebar if open
  document.getElementById("sidebar-wrapper")?.classList.add("-translate-x-full");
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("sidebar-wrapper");
  sidebar.classList.toggle("-translate-x-full");
}

// -------------------------------------------------------------
// USER VIEW LOGIC
// -------------------------------------------------------------
function renderUserHome() {
  const offices = DB.getOffices();
  const office = offices.find(o => o.namaKantor === currentUser.namaKantor) || offices[0];
  
  document.getElementById("user-jam-masuk").textContent = office.jamMasuk || "08:00";
  document.getElementById("user-jam-pulang").textContent = office.jamPulang || "16:00";
  document.getElementById("user-office-name-badge").textContent = office.namaKantor;

  // Check today's attendance status
  const attendance = DB.getAttendance();
  const todayStr = new Date().toISOString().slice(0, 10);
  const myToday = attendance.filter(a => a.nik === currentUser.nik && a.timestamp.slice(0, 10) === todayStr);

  const hasIn = myToday.find(a => a.tipe.toLowerCase().includes("masuk"));
  const hasOut = myToday.find(a => a.tipe.toLowerCase().includes("pulang"));

  const statusBadge = document.getElementById("user-status-today-badge");
  if (hasOut) {
    statusBadge.innerHTML = `<span class="bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-full text-xs">Sudah Absen Pulang</span>`;
  } else if (hasIn) {
    statusBadge.innerHTML = `<span class="bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-xs">Sudah Absen Masuk</span>`;
  } else {
    statusBadge.innerHTML = `<span class="bg-amber-100 text-amber-700 font-bold px-3 py-1.5 rounded-full text-xs">Belum Absen Hari Ini</span>`;
  }

  renderRecentTeamAttendance();
  renderUserLeavesSummary();
}

function renderRecentTeamAttendance() {
  const container = document.getElementById("team-attendance-list");
  if (!container) return;
  
  const allAtt = DB.getAttendance();
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayRecords = allAtt.filter(a => a.timestamp && a.timestamp.slice(0, 10) === todayStr);
  if (currentUser && currentUser.namaKantor) {
    todayRecords = todayRecords.filter(a => a.namaKantor === currentUser.namaKantor);
  }
  todayRecords = todayRecords.slice(0, 5);
  
  container.innerHTML = "";
  if (todayRecords.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">Belum ada riwayat presensi hari ini.</p>`;
    return;
  }

  todayRecords.forEach(rec => {
    const timeFormatted = new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    const isLate = rec.tipe.includes("Terlambat");
    const item = document.createElement("div");
    item.className = "flex items-center justify-between py-2 border-b border-slate-50 last:border-0";
    item.innerHTML = `
      <div class="flex items-center space-x-3">
        ${getAvatarBadge(rec.foto, "w-9 h-9", "w-5 h-5")}
        <div>
          <p class="text-xs font-bold text-slate-800">${rec.nama}</p>
          <p class="text-[10px] text-slate-500">${rec.jabatan} • ${timeFormatted} WITA</p>
        </div>
      </div>
      <span class="text-[10px] px-2.5 py-1 rounded-full font-semibold ${isLate ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
        ${rec.tipe}
      </span>
    `;
    container.appendChild(item);
  });
}

function renderUserLeavesSummary() {
  const container = document.getElementById("user-leaves-summary-list");
  if (!container) return;

  const allLeaves = (typeof DB !== 'undefined' && DB.getLeaves) ? DB.getLeaves() : [];
  const myLeaves = allLeaves.filter(l => String(l.nik) === String(currentUser.nik));

  container.innerHTML = "";
  if (myLeaves.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">Belum ada riwayat permohonan izin, sakit, atau cuti.</p>`;
    return;
  }

  myLeaves.slice(0, 5).forEach(l => {
    let tipeClass = "bg-amber-100 text-amber-800";
    if (l.tipe === "Sakit") tipeClass = "bg-rose-100 text-rose-800";
    if (l.tipe === "Cuti") tipeClass = "bg-purple-100 text-purple-800";

    const statusStr = l.status || "Menunggu Persetujuan";
    let statusBadge = "";
    if (statusStr === "Disetujui") {
      statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">✓ Disetujui</span>`;
    } else if (statusStr === "Ditolak") {
      statusBadge = `<span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">✕ Ditolak</span>`;
    } else {
      statusBadge = `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">⏳ Menunggu Persetujuan</span>`;
    }

    const item = document.createElement("div");
    item.className = "py-2.5 flex items-center justify-between border-b border-slate-50 last:border-0 text-xs";
    item.innerHTML = `
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="font-bold text-[10px] px-2 py-0.5 rounded-full ${tipeClass}">${l.tipe}</span>
          <span class="font-bold text-slate-800">${l.tglMulai} s/d ${l.tglSelesai}</span>
          ${statusBadge}
        </div>
        <p class="text-[11px] text-slate-500 max-w-md truncate">${l.alasan || '-'}</p>
        ${l.catatanAdmin ? `<p class="text-[10px] ${statusStr === 'Ditolak' ? 'text-rose-600' : 'text-slate-400'} italic">Catatan: "${l.catatanAdmin}"</p>` : ''}
      </div>
      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        ${l.surat ? `
          <button type="button" onclick="viewSuratModal('${l.surat.replace(/'/g, "\\'")}', '${(l.suratNama || 'Surat Bukti').replace(/'/g, "\\'")}', 'Surat Pengajuan ${l.tipe} - ${l.nama}')" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 cursor-pointer shadow-2xs inline-flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>Lihat Surat</span>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

// Camera & Modal Presensi Selfie
function openModalAbsen(type, peerTarget = null) {
  activeAbsenType = type;
  targetAbsenUser = peerTarget;

  const targetUser = targetAbsenUser || currentUser;
  const offices = DB.getOffices();
  const targetOfficeStr = String(targetUser.namaKantor || '').trim().toLowerCase();
  let office = offices.find(o => String(o.namaKantor || '').trim().toLowerCase() === targetOfficeStr);
  if (!office && offices.length > 0) {
    office = offices[0];
  }

  // Validasi: Lokasi kantor harus sudah diatur oleh Super Admin
  if (!office || !office.lat || !office.lng) {
    playChime(false);
    Swal.fire({
      icon: 'warning',
      title: 'Lokasi Kantor Belum Ditetapkan',
      text: 'Titik koordinat kantor desa belum diatur di sistem. Silakan hubungi Super Admin untuk menambahkan lokasi kantor terlebih dahulu.',
      confirmButtonColor: '#0f172a'
    });
    targetAbsenUser = null;
    return;
  }

  // Validasi Ketat Radius: Tidak boleh absen jika berada di luar radius
  const dist = calculateDistance(userCoords.lat, userCoords.lng, parseFloat(office.lat), parseFloat(office.lng));
  if (dist > office.radius) {
    playChime(false);
    Swal.fire({
      icon: 'error',
      title: 'Presensi Ditolak: Di Luar Radius!',
      html: `
        <div class="text-left text-xs space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
          <p>🏢 <b>Kantor Desa:</b> ${office.namaKantor}</p>
          <p>📏 <b>Jarak Anda:</b> <span class="text-rose-600 font-bold">${dist} meter</span></p>
          <p>🎯 <b>Batas Radius Maksimal:</b> ${office.radius} meter</p>
          <p class="text-rose-600 font-bold pt-2 border-t border-slate-200">❌ Anda berada di luar radius kantor desa. Presensi Datang, Pulang, maupun Absen Teman TIDAK BISA dilakukan.</p>
        </div>
      `,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Tutup'
    });
    targetAbsenUser = null;
    return;
  }

  const targetName = targetAbsenUser ? targetAbsenUser.nama : currentUser.nama;
  const targetOffice = targetAbsenUser ? targetAbsenUser.namaKantor : currentUser.namaKantor;

  document.getElementById("modal-absen-title").textContent = `Presensi Selfie - Absen ${type}`;
  document.getElementById("modal-absen-subtitle").textContent = `${targetName} (${targetOffice})`;

  document.getElementById("modal-presensi-selfie").classList.remove("hidden");
  startWebcam();
}

function closeModalAbsen() {
  document.getElementById("modal-presensi-selfie").classList.add("hidden");
  stopWebcam();
  targetAbsenUser = null; // Reset target teman
}

function startWebcam() {
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("webcam-canvas");
  const previewImg = document.getElementById("webcam-preview-img");
  
  previewImg.classList.add("hidden");
  video.classList.remove("hidden");

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } })
      .then(stream => {
        webcamStream = stream;
        video.srcObject = stream;
      })
      .catch(err => {
        console.warn("Camera access denied or unavailable, using fallback mock capture", err);
      });
  }
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
}

function captureSnapshot() {
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("webcam-canvas");
  const previewImg = document.getElementById("webcam-preview-img");

  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  if (webcamStream && video.videoWidth) {
    ctx.drawImage(video, 0, 0, 640, 480);
  } else {
    // Fallback simulated card
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FOTO PRESENSI SELFIE", 320, 200);
    ctx.font = "18px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(targetAbsenUser ? targetAbsenUser.nama : currentUser.nama, 320, 240);
  }

  // Burn Watermark (Waktu, Kantor, Koordinat)
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.fillRect(0, 390, 640, 90);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "bold 15px 'Plus Jakarta Sans', sans-serif";
  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) + " " + now.toLocaleTimeString('id-ID').replace(/\./g, ':') + " WITA";
  ctx.fillText(timeStr, 20, 420);
  ctx.font = "13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`Lokasi: ${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)} | ${targetAbsenUser ? targetAbsenUser.namaKantor : currentUser.namaKantor}`, 20, 445);
  ctx.fillText(`Akurasi GPS: ±${userCoords.accuracy}m | Absen: ${activeAbsenType}`, 20, 465);

  const photoData = canvas.toDataURL("image/jpeg", 0.85);
  previewImg.src = photoData;
  previewImg.classList.remove("hidden");
  video.classList.add("hidden");

  // Save Attendance Record
  saveAttendanceRecord(photoData);
}

function saveAttendanceRecord(photoUrl) {
  const offices = DB.getOffices();
  const user = targetAbsenUser || currentUser;
  const userOfficeStr = String(user.namaKantor || '').trim().toLowerCase();
  let office = offices.find(o => String(o.namaKantor || '').trim().toLowerCase() === userOfficeStr) || offices[0];

  if (!office) {
    closeModalAbsen();
    return;
  }

  const dist = calculateDistance(userCoords.lat, userCoords.lng, parseFloat(office.lat), parseFloat(office.lng));
  const inRadius = dist <= office.radius;

  // Proteksi ketat: Tidak bisa absen jika di luar radius
  if (!inRadius) {
    closeModalAbsen();
    playChime(false);
    Swal.fire({
      icon: 'error',
      title: 'Presensi Ditolak!',
      text: `Anda terdeteksi di luar radius lokasi kantor desa (${dist}m > ${office.radius}m). Presensi tidak dapat disimpan.`,
      confirmButtonColor: '#e11d48'
    });
    return;
  }
  
  // Calculate Late / On-Time
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const [jamMsk, mntMsk] = (office.jamMasuk || "08:00").split(":").map(Number);
  const targetMinute = jamMsk * 60 + mntMsk + (office.toleransi || 15);
  const currentMinute = hours * 60 + minutes;

  let tipeStatus = "";
  if (activeAbsenType === "Masuk") {
    tipeStatus = currentMinute <= targetMinute ? "Masuk (Tepat Waktu)" : "Masuk (Terlambat)";
  } else {
    tipeStatus = "Pulang (Tepat Waktu)";
  }

  // RIWAYAT PRESENSI TEMAN MASUK KE AKUN TEMAN YANG DIPRESENSIKAN (user.nik)
  const record = {
    nik: user.nik,
    nama: user.nama,
    jabatan: user.jabatan,
    namaKantor: user.namaKantor,
    tipe: tipeStatus,
    statusLokasi: `Valid di Radius (${dist}m)`,
    latLon: `${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)}`,
    foto: photoUrl,
    keterangan: targetAbsenUser ? `Diabsenkan oleh rekan (${currentUser.nama})` : "Presensi Mandiri"
  };

  DB.addAttendance(record);
  playChime(true);

  setTimeout(() => {
    closeModalAbsen();
    Swal.fire({
      icon: 'success',
      title: `Absen ${activeAbsenType} Berhasil!`,
      text: `${record.tipe} untuk ${record.nama}`,
      confirmButtonColor: '#0f172a'
    });
  }, 1000);
}

// Absensi Teman (Rekan Kerja Satu Kantor)
function renderPeerSelection() {
  const container = document.getElementById("peer-list-container");
  if (!container || !currentUser) return;

  const allUsers = DB.getUsers();
  const offices = DB.getOffices();
  const searchInput = document.getElementById("peer-search-input");
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filterKantorContainer = document.getElementById("peer-filter-kantor-container");
  const filterKantorSelect = document.getElementById("peer-filter-kantor");

  // Jika Super Admin / Admin Desa, sediakan opsi filter kantor
  let targetKantor = currentUser.namaKantor;
  if (currentUser.role === "super_admin" || currentUser.role === "admin_desa") {
    if (filterKantorContainer) filterKantorContainer.classList.remove("hidden");
    if (filterKantorSelect && filterKantorSelect.options.length === 0) {
      filterKantorSelect.innerHTML = `<option value="ALL">Semua Kantor Desa</option>` + offices.map(o => `<option value="${o.namaKantor}">${o.namaKantor}</option>`).join("");
      if (currentUser.role === "admin_desa") {
        filterKantorSelect.value = currentUser.namaKantor;
      }
    }
    if (filterKantorSelect && filterKantorSelect.value !== "ALL") {
      targetKantor = filterKantorSelect.value;
    } else if (filterKantorSelect && filterKantorSelect.value === "ALL") {
      targetKantor = "ALL";
    }
  } else {
    if (filterKantorContainer) filterKantorContainer.classList.add("hidden");
  }

  // Filter peers
  let peers = allUsers.filter(u => {
    // Abaikan akun diri sendiri
    if (String(u.nik).trim() === String(currentUser.nik).trim()) return false;
    
    // Filter kantor
    if (targetKantor !== "ALL") {
      const uKantor = String(u.namaKantor || "").trim().toLowerCase();
      const myKantor = String(targetKantor || "").trim().toLowerCase();
      if (uKantor !== myKantor) return false;
    }

    // Filter pencarian nama / NIK / jabatan
    if (searchQuery) {
      const matchNama = String(u.nama || "").toLowerCase().includes(searchQuery);
      const matchNik = String(u.nik || "").toLowerCase().includes(searchQuery);
      const matchJabatan = String(u.jabatan || "").toLowerCase().includes(searchQuery);
      if (!matchNama && !matchNik && !matchJabatan) return false;
    }

    return true;
  });

  container.innerHTML = "";

  if (peers.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-100">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </div>
        <h4 class="font-bold text-slate-800 text-sm">Tidak Ada Rekan Kerja Ditemukan</h4>
        <p class="text-xs text-slate-500 mt-1">Belum ada rekan kerja yang terdaftar di unit ${targetKantor === 'ALL' ? 'ini' : targetKantor} atau cocok dengan kata kunci pencarian.</p>
      </div>
    `;
    return;
  }

  peers.forEach(peer => {
    const card = document.createElement("div");
    card.className = "card-modern p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition";
    card.innerHTML = `
      <div class="flex items-center space-x-3.5">
        <img src="${peer.foto || DEFAULT_AVATAR}" class="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-sm flex-shrink-0">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-slate-900 text-sm truncate">${peer.nama}</h4>
          <p class="text-xs text-slate-500 truncate">${peer.jabatan}</p>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            <span class="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">NIK: ${peer.nik}</span>
            <span class="inline-block text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium truncate max-w-[130px]">${peer.namaKantor}</span>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        <button type="button" onclick="absenkanTeman('${peer.nik}', 'Masuk')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1 cursor-pointer">
          <span>🟢 Absen Datang</span>
        </button>
        <button type="button" onclick="absenkanTeman('${peer.nik}', 'Pulang')" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1 cursor-pointer">
          <span>🔵 Absen Pulang</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function absenkanTeman(nik, type) {
  const users = DB.getUsers();
  // Gunakan perbandingan String agar NIK angka maupun teks cocok secara akurat
  const peer = users.find(u => String(u.nik).trim() === String(nik).trim());
  if (peer) {
    openModalAbsen(type, peer);
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Pegawai Tidak Ditemukan',
      text: `Data rekan dengan NIK ${nik} tidak ditemukan dalam sistem.`
    });
  }
}

// User Profile & Account (Universal for Super Admin, Admin Desa, & Pegawai)
function renderUserProfile() {
  if (!currentUser) return;

  const nikInput = document.getElementById("profile-nik-val");
  const nikBadge = document.getElementById("profile-nik-badge");
  const nikHint = document.getElementById("profile-nik-hint");

  if (nikInput) {
    nikInput.value = currentUser.nik || "";
    if (currentUser.role === "super_admin") {
      nikInput.disabled = false;
      nikInput.readOnly = false;
      nikInput.className = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 font-bold text-slate-900 shadow-2xs";
      if (nikBadge) nikBadge.classList.remove("hidden");
      if (nikHint) {
        nikHint.classList.remove("hidden");
        nikHint.textContent = "✓ Mode Super Admin: Anda dapat mengganti NIK / Username akun Anda kapan saja.";
      }
    } else {
      nikInput.disabled = true;
      nikInput.readOnly = true;
      nikInput.className = "w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed";
      if (nikBadge) nikBadge.classList.add("hidden");
      if (nikHint) nikHint.classList.add("hidden");
    }
  }

  document.getElementById("profile-nama-val").value = currentUser.nama || "";
  
  const jabatanInput = document.getElementById("profile-jabatan-input");
  if (jabatanInput) jabatanInput.value = currentUser.jabatan || "";
  
  document.getElementById("profile-kantor-val").textContent = currentUser.namaKantor || "-";
  document.getElementById("profile-hp-val").value = currentUser.noHp || "";
  document.getElementById("profile-avatar-preview").src = (currentUser.foto && !currentUser.foto.includes("unsplash.com")) ? currentUser.foto : DEFAULT_AVATAR;

  // Render role badge
  const roleBadgeContainer = document.getElementById("profile-role-badge");
  if (roleBadgeContainer) {
    if (currentUser.role === "super_admin") {
      roleBadgeContainer.innerHTML = `<span class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-black border border-amber-200">👑 Super Administrator</span>`;
    } else if (currentUser.role === "admin_desa") {
      roleBadgeContainer.innerHTML = `<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-black border border-blue-200">🏢 Administrator Desa</span>`;
    } else {
      roleBadgeContainer.innerHTML = `<span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black border border-emerald-200">👤 Pegawai Desa</span>`;
    }
  }
}

function saveUserProfile(e) {
  e.preventDefault();
  const nama = document.getElementById("profile-nama-val").value.trim();
  const jabatanInput = document.getElementById("profile-jabatan-input");
  const jabatan = jabatanInput ? jabatanInput.value.trim() : currentUser.jabatan;
  const noHp = document.getElementById("profile-hp-val").value.trim();
  const newPass = document.getElementById("profile-newpass-val").value.trim();

  // Handle NIK / Username change for Super Admin
  const nikInput = document.getElementById("profile-nik-val");
  const newNik = nikInput ? nikInput.value.trim() : currentUser.nik;
  const oldNik = currentUser.nik;

  if (currentUser.role === "super_admin" && newNik && newNik !== oldNik) {
    const allUsers = DB.getUsers();
    const isTaken = allUsers.some(u => String(u.nik) === String(newNik) && String(u.nik) !== String(oldNik));
    if (isTaken) {
      Swal.fire({
        icon: 'error',
        title: 'NIK / Username Sudah Terdaftar',
        text: 'NIK atau Username tersebut telah digunakan oleh pengguna lain. Silakan pilih NIK / Username yang lain.'
      });
      return;
    }

    // Update old NIK in storage
    const updatedUsers = allUsers.map(u => {
      if (String(u.nik) === String(oldNik)) {
        return { ...u, nik: newNik, nama, jabatan, noHp, ...(newPass ? { password: newPass } : {}) };
      }
      return u;
    });
    localStorage.setItem(STORAGE_PREFIX + "users", JSON.stringify(updatedUsers));

    // Sinkronisasi ke Google Sheets: hapus akun lama dengan oldNik
    API.post({ action: "deleteUser", nik: oldNik });

    currentUser.nik = newNik;
  }

  currentUser.nama = nama;
  currentUser.jabatan = jabatan;
  currentUser.noHp = noHp;
  if (newPass) currentUser.password = newPass;

  DB.saveUser(currentUser);
  sessionStorage.setItem("mo_eeya_session", JSON.stringify(currentUser));
  playChime(true);

  // Update UI immediately
  document.querySelectorAll(".user-name-display").forEach(el => el.textContent = currentUser.nama);
  document.querySelectorAll(".user-role-display").forEach(el => el.textContent = currentUser.jabatan);
  const headerNik = document.getElementById("header-user-nik");
  if (headerNik) headerNik.textContent = currentUser.nik;

  Swal.fire({
    icon: 'success',
    title: 'Profil Berhasil Disimpan',
    text: 'Informasi profil dan akun Anda telah berhasil diperbarui.',
    timer: 1800,
    showConfirmButton: false
  });

  renderUserProfile();
}

// Compress and set avatar photo
function compressAndSetAvatar(imgSrc) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement("canvas");
    const maxDim = 256;
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    currentUser.foto = optimizedDataUrl;
    document.getElementById("profile-avatar-preview").src = optimizedDataUrl;
    DB.saveUser(currentUser);
    sessionStorage.setItem("mo_eeya_session", JSON.stringify(currentUser));
    document.querySelectorAll(".user-avatar-img").forEach(el => el.src = optimizedDataUrl);

    playChime(true);
    Swal.fire({
      icon: 'success',
      title: 'Foto Profil Diperbarui',
      text: 'Foto profil baru Anda telah tersimpan dan disinkronkan.',
      timer: 1500,
      showConfirmButton: false
    });
  };
  img.src = imgSrc;
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      compressAndSetAvatar(e.target.result);
    };
    reader.readAsDataURL(file);
  }
}

function resetAvatarToDefault() {
  Swal.fire({
    title: 'Hapus Foto Profil?',
    text: 'Foto profil akan dikembalikan ke avatar default.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0f172a',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Kembalikan Default',
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      currentUser.foto = "";
      document.getElementById("profile-avatar-preview").src = DEFAULT_AVATAR;
      DB.saveUser(currentUser);
      sessionStorage.setItem("mo_eeya_session", JSON.stringify(currentUser));
      document.querySelectorAll(".user-avatar-img").forEach(el => el.src = DEFAULT_AVATAR);
      Swal.fire({
        icon: 'success',
        title: 'Foto Profil Direset',
        timer: 1200,
        showConfirmButton: false
      });
    }
  });
}

// Webcam Snapshot for Avatar
let avatarWebcamStream = null;

function openAvatarWebcamModal() {
  const modal = document.getElementById("modal-avatar-webcam");
  if (!modal) return;
  modal.classList.remove("hidden");

  const video = document.getElementById("avatar-webcam-video");
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 300, facingMode: "user" } })
      .then(stream => {
        avatarWebcamStream = stream;
        video.srcObject = stream;
      })
      .catch(err => {
        console.warn("Gagal membuka webcam untuk avatar:", err);
        closeAvatarWebcamModal();
        Swal.fire({
          icon: 'warning',
          title: 'Kamera Tidak Tersedia',
          text: 'Tidak dapat mengakses webcam. Pastikan izin kamera aktif atau gunakan tombol Unggah Foto.',
          confirmButtonColor: '#0f172a'
        });
      });
  }
}

function closeAvatarWebcamModal() {
  const modal = document.getElementById("modal-avatar-webcam");
  if (modal) modal.classList.add("hidden");
  if (avatarWebcamStream) {
    avatarWebcamStream.getTracks().forEach(track => track.stop());
    avatarWebcamStream = null;
  }
}

function captureAvatarFromWebcam() {
  const video = document.getElementById("avatar-webcam-video");
  const canvas = document.getElementById("avatar-webcam-canvas");
  if (!video || !canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 256;

  // Center crop video into square canvas
  const minDim = Math.min(video.videoWidth || 300, video.videoHeight || 300);
  const startX = ((video.videoWidth || 300) - minDim) / 2;
  const startY = ((video.videoHeight || 300) - minDim) / 2;

  ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 256, 256);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

  closeAvatarWebcamModal();
  compressAndSetAvatar(dataUrl);
}

// Pengajuan Izin / Sakit / Cuti Modal Handlers
let leaveCameraStream = null;

function openModalLeave(type) {
  document.getElementById("modal-leave-type").value = type;
  document.getElementById("modal-leave-title").textContent = `Form Pengajuan ${type}`;
  document.getElementById("modal-leave-desc").textContent = `Silakan isi detail permohonan ${type.toLowerCase()} dan lampirkan surat bukti untuk divalidasi pimpinan.`;
  
  // Set default dates to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const mul = document.getElementById("leave-tgl-mulai");
  const sel = document.getElementById("leave-tgl-selesai");
  const als = document.getElementById("leave-alasan");
  if (mul) mul.value = todayStr;
  if (sel) sel.value = todayStr;
  if (als) als.value = "";

  clearLeaveSuratUpload();
  document.getElementById("modal-pengajuan-leave").classList.remove("hidden");
}

function closeModalLeave() {
  document.getElementById("modal-pengajuan-leave").classList.add("hidden");
}

function handleLeaveSuratUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
    Swal.fire({
      icon: 'warning',
      title: 'Format File Tidak Didukung',
      text: 'Silakan pilih berkas gambar (JPG, PNG, WEBP) atau PDF surat keterangan.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    Swal.fire({
      icon: 'warning',
      title: 'Ukuran Terlalu Besar',
      text: 'Maksimal ukuran berkas surat adalah 5MB.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const rawData = evt.target.result;
    
    // Jika gambar, kompres agar hemat kuota Sheets dan penyimpanan lokal
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.78);
        applySuratData(compressedBase64, file.name, file.size);
      };
      img.src = rawData;
    } else {
      applySuratData(rawData, file.name, file.size);
    }
  };
  reader.readAsDataURL(file);
}

function applySuratData(base64, filename, size = 0) {
  const bInput = document.getElementById("leave-surat-base64");
  const nInput = document.getElementById("leave-surat-name");
  if (bInput) bInput.value = base64;
  if (nInput) nInput.value = filename;

  const thumb = document.getElementById("leave-surat-thumb");
  if (thumb) {
    if (base64.startsWith("data:image/")) {
      thumb.src = base64;
    } else {
      thumb.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path><polyline points='14 2 14 8 20 8'></polyline><line x1='16' y1='13' x2='8' y2='13'></line><line x1='16' y1='17' x2='8' y2='17'></line><polyline points='10 9 9 9 8 9'></polyline></svg>";
    }
  }

  const fnEl = document.getElementById("leave-surat-filename");
  const fsEl = document.getElementById("leave-surat-filesize");
  if (fnEl) fnEl.textContent = filename;
  if (fsEl) fsEl.textContent = size ? `${(size / 1024).toFixed(1)} KB` : 'Siap diunggah';

  document.getElementById("leave-surat-empty-state")?.classList.add("hidden");
  document.getElementById("leave-surat-filled-state")?.classList.remove("hidden");
}

function clearLeaveSuratUpload() {
  const bInput = document.getElementById("leave-surat-base64");
  const nInput = document.getElementById("leave-surat-name");
  const fInput = document.getElementById("leave-surat-file-input");
  if (bInput) bInput.value = "";
  if (nInput) nInput.value = "";
  if (fInput) fInput.value = "";

  document.getElementById("leave-surat-empty-state")?.classList.remove("hidden");
  document.getElementById("leave-surat-filled-state")?.classList.add("hidden");
}

function previewCurrentLeaveSurat() {
  const base64 = document.getElementById("leave-surat-base64")?.value;
  const name = document.getElementById("leave-surat-name")?.value || "Surat Bukti";
  if (!base64) return;
  viewSuratModal(base64, name, "Pratinjau Surat yang Dipilih");
}

// Camera Web/HP Capture for Surat Bukti
async function openLeaveCameraModal() {
  const modal = document.getElementById("modal-camera-surat");
  const video = document.getElementById("leave-camera-video");
  if (!modal || !video) return;

  try {
    modal.classList.remove("hidden");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    leaveCameraStream = stream;
    video.srcObject = stream;
    video.play();
  } catch (err) {
    console.warn("Camera error:", err);
    closeLeaveCameraModal();
    Swal.fire({
      icon: 'warning',
      title: 'Kamera Tidak Dapat Dibuka',
      text: 'Tidak dapat mengakses perangkat kamera. Silakan gunakan tombol "Pilih Berkas" untuk mengunggah foto surat.',
      confirmButtonColor: '#0f172a'
    });
  }
}

function closeLeaveCameraModal() {
  const modal = document.getElementById("modal-camera-surat");
  if (modal) modal.classList.add("hidden");
  if (leaveCameraStream) {
    leaveCameraStream.getTracks().forEach(t => t.stop());
    leaveCameraStream = null;
  }
}

function captureLeaveSuratPhoto() {
  const video = document.getElementById("leave-camera-video");
  const canvas = document.getElementById("leave-camera-canvas");
  if (!video || !canvas) return;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL("image/jpeg", 0.78);
  const filename = `foto_surat_${Date.now()}.jpg`;
  applySuratData(base64, filename, Math.round(base64.length * 0.75));

  closeLeaveCameraModal();
}

// Modal View / Preview Surat untuk Pegawai & Admin
function viewSuratModal(suratData, suratNama = "Dokumen Bukti", info = "") {
  const modal = document.getElementById("modal-view-surat");
  const body = document.getElementById("view-surat-modal-body");
  const title = document.getElementById("view-surat-modal-title");
  const sub = document.getElementById("view-surat-modal-subtitle");
  const dl = document.getElementById("view-surat-download-link");

  if (!modal || !body) return;

  if (title) title.textContent = suratNama || "Dokumen Bukti Surat";
  if (sub) sub.textContent = info || "Berkas pendukung permohonan";

  if (dl) {
    dl.href = suratData || "#";
    dl.download = suratNama || "surat-bukti";
  }

  body.innerHTML = "";
  if (!suratData) {
    body.innerHTML = `<p class="text-xs text-slate-400 py-12 text-center">Tidak ada berkas yang dilampirkan.</p>`;
  } else if (suratData.startsWith("data:application/pdf")) {
    body.innerHTML = `<iframe src="${suratData}" class="w-full h-96 rounded-xl border border-slate-200"></iframe>`;
  } else {
    body.innerHTML = `<img src="${suratData}" alt="Surat Bukti" class="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm border border-slate-200">`;
  }

  modal.classList.remove("hidden");
}

function closeViewSuratModal() {
  const modal = document.getElementById("modal-view-surat");
  if (modal) modal.classList.add("hidden");
}

function submitLeaveRequest(e) {
  e.preventDefault();
  const type = document.getElementById("modal-leave-type").value;
  const tglMulai = document.getElementById("leave-tgl-mulai").value;
  const tglSelesai = document.getElementById("leave-tgl-selesai").value;
  const alasan = document.getElementById("leave-alasan").value;
  const surat = document.getElementById("leave-surat-base64")?.value || "";
  const suratNama = document.getElementById("leave-surat-name")?.value || "";

  if (!surat) {
    Swal.fire({
      icon: 'warning',
      title: 'Surat Bukti Wajib Diunggah',
      text: `Harap unggah surat keterangan atau foto bukti permohonan ${type.toLowerCase()} (surat dokter / surat dinas).`,
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  if (new Date(tglMulai) > new Date(tglSelesai)) {
    Swal.fire({
      icon: 'warning',
      title: 'Rentang Tanggal Tidak Valid',
      text: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  const leave = {
    nik: currentUser.nik,
    nama: currentUser.nama,
    jabatan: currentUser.jabatan,
    namaKantor: currentUser.namaKantor,
    tipe: type,
    tglMulai,
    tglSelesai,
    alasan,
    surat,
    suratNama,
    status: "Menunggu Persetujuan",
    created_at: new Date().toISOString()
  };

  DB.addLeave(leave);

  closeModalLeave();
  playChime(true);

  Swal.fire({
    icon: 'success',
    title: `Pengajuan ${type} Berhasil Dikirim!`,
    text: 'Permohonan Anda berhasil diajukan dengan lampiran surat dan sedang menunggu validasi resmi dari Admin/Pimpinan.',
    confirmButtonColor: '#0f172a'
  }).then(() => {
    if (currentTab === "user-home") renderUserHome();
    if (currentTab === "user-history") renderUserHistory();
  });
}

// User Attendance History
function renderUserHistory() {
  const container = document.getElementById("user-history-tbody");
  if (!container) return;

  const records = DB.getAttendance().filter(a => a.nik === currentUser.nik);
  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">Belum ada riwayat absensi.</td></tr>`;
    return;
  }

  records.forEach(rec => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-xs";
    const dateFormatted = new Date(rec.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + " " + new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    
    let badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (rec.tipe.includes("Terlambat")) badgeClass = "bg-amber-50 text-amber-700 border border-amber-200";
    if (rec.tipe.includes("Izin") || rec.tipe.includes("Sakit") || rec.tipe.includes("Cuti")) badgeClass = "bg-purple-50 text-purple-700 border border-purple-200";

    tr.innerHTML = `
      <td class="p-3 font-medium text-slate-800">${dateFormatted}</td>
      <td class="p-3"><span class="px-2.5 py-1 rounded-full font-semibold ${badgeClass}">${rec.tipe}</span></td>
      <td class="p-3 text-slate-600">${rec.statusLokasi}</td>
      <td class="p-3 text-slate-500">${rec.keterangan || '-'}</td>
      <td class="p-3">
        ${(rec.foto && !rec.foto.includes("unsplash.com") && rec.foto.startsWith("data:image/")) ? `<img src="${rec.foto}" onclick="viewPhotoModal('${rec.foto}')" class="w-8 h-8 rounded-lg object-cover cursor-pointer hover:opacity-80 border shadow-xs">` : `<div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 text-xs" title="Tanpa Foto">📷</div>`}
      </td>
    `;
    container.appendChild(tr);
  });
}

function viewPhotoModal(url) {
  Swal.fire({
    imageUrl: url,
    imageAlt: 'Foto Selfie Presensi',
    showConfirmButton: false,
    showCloseButton: true,
    background: '#0f172a'
  });
}

// -------------------------------------------------------------
// ADMIN & SUPER ADMIN VIEW LOGIC
// -------------------------------------------------------------
function renderDashboard() {
  const users = DB.getUsers();
  const offices = DB.getOffices();
  const attendance = DB.getAttendance();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter based on role
  let filteredUsers = users.filter(u => u.role === "user");
  let filteredAtt = attendance.filter(a => a.timestamp.slice(0, 10) === todayStr);

  if (currentUser.role === "admin_desa") {
    filteredUsers = filteredUsers.filter(u => u.namaKantor === currentUser.namaKantor);
    filteredAtt = filteredAtt.filter(a => a.namaKantor === currentUser.namaKantor);
  }

  const totalPegawai = filteredUsers.length || 1;
  const totalHadir = filteredAtt.filter(a => a.tipe.includes("Masuk")).length;
  const totalTepatWaktu = filteredAtt.filter(a => a.tipe.includes("Tepat Waktu")).length;
  const totalTerlambat = filteredAtt.filter(a => a.tipe.includes("Terlambat")).length;
  const totalIzinSakit = filteredAtt.filter(a => a.tipe.includes("Izin") || a.tipe.includes("Sakit") || a.tipe.includes("Cuti")).length;

  const pctHadir = Math.round((totalHadir / totalPegawai) * 100);

  // Update Stat Cards matching reference image
  document.getElementById("stat-total-pegawai").textContent = totalPegawai;
  document.getElementById("stat-total-hadir").textContent = totalHadir;
  document.getElementById("stat-total-terlambat").textContent = totalTerlambat;
  document.getElementById("stat-pct-kehadiran").textContent = `${pctHadir}%`;
  document.getElementById("stat-gauge-text").textContent = `${pctHadir}%`;

  // Circular Gauge Stroke
  const gaugeCircle = document.getElementById("stat-gauge-circle");
  if (gaugeCircle) {
    const circumference = 2 * Math.PI * 40; // r=40
    const offset = circumference - (pctHadir / 100) * circumference;
    gaugeCircle.style.strokeDashoffset = offset;
  }

  renderCharts(totalTepatWaktu, totalTerlambat, totalIzinSakit, totalPegawai - totalHadir);
  renderRecentDashboardFeed(filteredAtt);
}

function renderCharts(tepatWaktu, terlambat, izinSakit, belumAbsen) {
  const ctxDonut = document.getElementById("chart-attendance-donut");
  if (ctxDonut) {
    if (chartAttendance) chartAttendance.destroy();
    chartAttendance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Tepat Waktu', 'Terlambat', 'Izin/Cuti', 'Belum Hadir'],
        datasets: [{
          data: [tepatWaktu, terlambat, izinSakit, Math.max(0, belumAbsen)],
          backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#e2e8f0'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11 } } }
        },
        cutout: '72%'
      }
    });
  }

  const ctxBar = document.getElementById("chart-weekly-bar");
  if (ctxBar) {
    if (chartWeekly) chartWeekly.destroy();
    chartWeekly = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Hari Ini'],
        datasets: [{
          label: 'Hadir (%)',
          data: [92, 88, 95, 85, 90, 80, 94],
          backgroundColor: '#3b82f6',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function renderRecentDashboardFeed(records) {
  const container = document.getElementById("dashboard-feed-tbody");
  if (!container) return;

  container.innerHTML = "";
  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 text-xs">Belum ada aktivitas presensi hari ini.</td></tr>`;
    return;
  }

  records.slice(0, 5).forEach(rec => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-xs";
    const timeFormatted = new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    
    tr.innerHTML = `
      <td class="p-3">
        <div class="flex items-center space-x-2.5">
          ${getAvatarBadge(rec.foto, "w-8 h-8", "w-4 h-4")}
          <div>
            <p class="font-bold text-slate-800">${rec.nama}</p>
            <p class="text-[10px] text-slate-400">${rec.jabatan}</p>
          </div>
        </div>
      </td>
      <td class="p-3 text-slate-600">${rec.namaKantor}</td>
      <td class="p-3 font-semibold text-slate-700">${timeFormatted} WITA</td>
      <td class="p-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${rec.tipe.includes('Terlambat') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${rec.tipe}</span></td>
      <td class="p-3 text-slate-500">${rec.statusLokasi}</td>
    `;
    container.appendChild(tr);
  });
}

// =============================================================
// REUSABLE PAGINATION CONTROLS GENERATOR
// =============================================================
function renderPaginationControls(containerId, currentPage, totalPages, goToPageFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  
  // Tombol Prev
  const isPrevDisabled = currentPage <= 1;
  html += `
    <button type="button" ${isPrevDisabled ? 'disabled' : `onclick="${goToPageFnName}(${currentPage - 1})"`}
      class="px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${isPrevDisabled ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer shadow-2xs'}">
      ‹ Prev
    </button>
  `;

  // Nomor Halaman cerdas
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (currentPage <= 3) {
    endPage = Math.min(totalPages, 5);
  }
  if (currentPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
  }

  if (startPage > 1) {
    html += `
      <button type="button" onclick="${goToPageFnName}(1)" class="w-7 h-7 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition cursor-pointer">1</button>
    `;
    if (startPage > 2) {
      html += `<span class="px-1 text-slate-400">...</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    if (p === currentPage) {
      html += `
        <button type="button" class="w-7 h-7 rounded-lg text-xs font-black text-white bg-slate-900 border border-slate-900 shadow-xs">${p}</button>
      `;
    } else {
      html += `
        <button type="button" onclick="${goToPageFnName}(${p})" class="w-7 h-7 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition cursor-pointer">${p}</button>
      `;
    }
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="px-1 text-slate-400">...</span>`;
    }
    html += `
      <button type="button" onclick="${goToPageFnName}(${totalPages})" class="w-7 h-7 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition cursor-pointer">${totalPages}</button>
    `;
  }

  // Tombol Next
  const isNextDisabled = currentPage >= totalPages;
  html += `
    <button type="button" ${isNextDisabled ? 'disabled' : `onclick="${goToPageFnName}(${currentPage + 1})"`}
      class="px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${isNextDisabled ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100 cursor-pointer shadow-2xs'}">
      Next ›
    </button>
  `;

  container.innerHTML = html;
}

// -------------------------------------------------------------
// KOREKSI ABSEN STATE & HANDLERS
// -------------------------------------------------------------
let koreksiPagination = {
  currentPage: 1,
  perPage: 10,
  selectedIds: new Set()
};

function goToKoreksiPage(page) {
  koreksiPagination.currentPage = page;
  renderKoreksiTable();
}

function changeKoreksiPerPage(val) {
  koreksiPagination.perPage = parseInt(val) || 10;
  koreksiPagination.currentPage = 1;
  renderKoreksiTable();
}

function toggleKoreksiRowCheck(id, isChecked) {
  if (isChecked) {
    koreksiPagination.selectedIds.add(String(id));
  } else {
    koreksiPagination.selectedIds.delete(String(id));
  }
  updateKoreksiSelectionUI();
}

function toggleSelectAllKoreksi(isChecked) {
  const checkboxes = document.querySelectorAll(".koreksi-row-check");
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = cb.getAttribute("data-id");
    if (isChecked) {
      koreksiPagination.selectedIds.add(String(id));
    } else {
      koreksiPagination.selectedIds.delete(String(id));
    }
  });
  updateKoreksiSelectionUI();
}

function updateKoreksiSelectionUI() {
  const count = koreksiPagination.selectedIds.size;
  const countEl = document.getElementById("koreksi-selected-count");
  const containerEl = document.getElementById("koreksi-selected-container");
  const btnDeleteSelected = document.getElementById("btn-koreksi-delete-selected");
  const labelBtn = document.getElementById("label-koreksi-delete-selected");
  const checkAll = document.getElementById("koreksi-check-all");

  if (countEl) countEl.textContent = count;
  if (containerEl) {
    if (count > 0) containerEl.classList.remove("hidden");
    else containerEl.classList.add("hidden");
  }

  if (btnDeleteSelected) {
    btnDeleteSelected.disabled = (count === 0);
  }
  if (labelBtn) {
    labelBtn.textContent = count > 0 ? `Hapus yang Dipilih (${count})` : "Hapus yang Dipilih";
  }

  // Update check all state for current page
  if (checkAll) {
    const checkboxes = document.querySelectorAll(".koreksi-row-check");
    if (checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked)) {
      checkAll.checked = true;
      checkAll.indeterminate = false;
    } else if (checkboxes.length > 0 && Array.from(checkboxes).some(cb => cb.checked)) {
      checkAll.checked = false;
      checkAll.indeterminate = true;
    } else {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    }
  }
}

function deleteSelectedKoreksi() {
  const ids = Array.from(koreksiPagination.selectedIds);
  if (ids.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Tidak Ada Data Terpilih',
      text: 'Silakan centang data presensi yang ingin dihapus terlebih dahulu.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  Swal.fire({
    title: `Hapus ${ids.length} Data Presensi Terpilih?`,
    text: `Apakah Anda yakin ingin menghapus ${ids.length} rekaman presensi yang dipilih? Tindakan ini permanen dan data akan dihapus dari sistem & Google Sheets.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: `Ya, Hapus (${ids.length}) Data`,
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      DB.deleteMultipleAttendance(ids);
      koreksiPagination.selectedIds.clear();
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Dihapus',
        text: `${ids.length} data presensi telah berhasil dihapus.`,
        timer: 1500,
        showConfirmButton: false
      });
      renderKoreksiTable();
      if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof filterLaporan === 'function') filterLaporan();
    }
  });
}

function deleteAllKoreksi() {
  let records = DB.getAttendance();
  if (currentUser.role === "admin_desa") {
    records = records.filter(r => r.namaKantor === currentUser.namaKantor);
  }

  if (records.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Tidak Ada Data',
      text: 'Tidak ada data presensi yang dapat dihapus.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  const officeInfo = (currentUser.role === "admin_desa") ? `pada unit ${currentUser.namaKantor}` : 'pada seluruh sistem';

  Swal.fire({
    title: 'Hapus SEMUA Data Presensi?',
    html: `Apakah Anda yakin ingin menghapus <b>SEMUA</b> rekaman presensi (${records.length} data) ${officeInfo}?<br><br><span class="text-xs text-rose-600 font-bold">⚠️ Perhatian: Seluruh data absensi akan dihapus permanen dari sistem & Google Sheets!</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus Semua!',
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      const idsToDelete = records.map(r => r.id);
      DB.deleteMultipleAttendance(idsToDelete);
      koreksiPagination.selectedIds.clear();
      koreksiPagination.currentPage = 1;
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Semua Data Terhapus',
        text: 'Seluruh rekaman presensi telah dibersihkan dari sistem.',
        timer: 1500,
        showConfirmButton: false
      });
      renderKoreksiTable();
      if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof filterLaporan === 'function') filterLaporan();
    }
  });
}

// Koreksi Absen (Admin Desa & Super Admin)
function renderKoreksiTable() {
  const container = document.getElementById("koreksi-table-tbody");
  if (!container) return;

  let records = DB.getAttendance();
  if (currentUser.role === "admin_desa") {
    records = records.filter(r => r.namaKantor === currentUser.namaKantor);
  }

  // Update total count indicator
  const totalCountEl = document.getElementById("koreksi-total-count");
  if (totalCountEl) totalCountEl.textContent = records.length;

  container.innerHTML = "";
  if (records.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center">
          <div class="flex flex-col items-center justify-center space-y-3">
            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <p class="text-xs text-slate-500 font-medium">Tidak ada data absensi untuk dikoreksi pada unit kantor ini.</p>
            <button onclick="openModalTambahKoreksi()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>+ Buat Koreksi Presensi Baru</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    const pagInfo = document.getElementById("koreksi-pagination-info");
    if (pagInfo) pagInfo.textContent = "Menampilkan 0 data";
    renderPaginationControls("koreksi-pagination-controls", 1, 0, "goToKoreksiPage");
    updateKoreksiSelectionUI();
    return;
  }

  // Hitung Paginasi
  const totalRecords = records.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / koreksiPagination.perPage));
  if (koreksiPagination.currentPage > totalPages) koreksiPagination.currentPage = totalPages;
  if (koreksiPagination.currentPage < 1) koreksiPagination.currentPage = 1;

  const startIndex = (koreksiPagination.currentPage - 1) * koreksiPagination.perPage;
  const endIndex = Math.min(startIndex + koreksiPagination.perPage, totalRecords);
  const pageRecords = records.slice(startIndex, endIndex);

  const pagInfo = document.getElementById("koreksi-pagination-info");
  if (pagInfo) {
    pagInfo.textContent = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalRecords} data`;
  }

  pageRecords.forEach(rec => {
    const tr = document.createElement("tr");
    const isAlpa = rec.tipe && (rec.tipe.toLowerCase().includes("tidak hadir") || rec.tipe.toLowerCase().includes("alpa"));
    const isChecked = koreksiPagination.selectedIds.has(String(rec.id));
    tr.className = `${isChecked ? 'bg-rose-50/70 ' : ''}${isAlpa ? 'bg-rose-50/40 ' : ''}hover:bg-slate-50 transition border-b border-slate-100 text-xs`;
    const dateFormatted = new Date(rec.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + " " + new Date(rec.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

    const badgeStyle = isAlpa 
      ? 'bg-rose-100 text-rose-700 border border-rose-300 font-bold'
      : 'bg-slate-100 text-slate-700 font-semibold';

    tr.innerHTML = `
      <td class="p-3 text-center">
        <input type="checkbox" class="koreksi-row-check cursor-pointer rounded w-4 h-4 text-rose-600 focus:ring-rose-500" data-id="${rec.id}" ${isChecked ? 'checked' : ''} onchange="toggleKoreksiRowCheck('${rec.id}', this.checked)">
      </td>
      <td class="p-3 font-medium text-slate-800">${dateFormatted}</td>
      <td class="p-3">
        <p class="font-bold text-slate-800">${rec.nama}</p>
        <p class="text-[10px] text-slate-500">NIK: ${rec.nik} • ${rec.namaKantor}</p>
      </td>
      <td class="p-3"><span class="px-2.5 py-1 rounded-full text-[10px] ${badgeStyle}">${rec.tipe}</span></td>
      <td class="p-3 text-slate-600">${rec.statusLokasi}</td>
      <td class="p-3 text-slate-500 italic">${rec.keterangan || '-'}</td>
      <td class="p-3">
        <div class="flex items-center space-x-1.5">
          <button onclick="openModalKoreksi('${rec.id}')" title="Koreksi Presensi Pegawai" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            <span>✏️ Koreksi</span>
          </button>
          <button onclick="deletePresensiConfirm('${rec.id}')" title="Hapus Presensi" class="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span>Hapus</span>
          </button>
        </div>
      </td>
    `;
    container.appendChild(tr);
  });

  renderPaginationControls("koreksi-pagination-controls", koreksiPagination.currentPage, totalPages, "goToKoreksiPage");
  updateKoreksiSelectionUI();
}

let activeKoreksiId = null;

function openModalTambahKoreksi() {
  activeKoreksiId = null;
  
  const titleEl = document.getElementById("modal-koreksi-title");
  const subEl = document.getElementById("modal-koreksi-subtitle");
  const submitTextEl = document.getElementById("btn-koreksi-submit-text");
  const hapusBtn = document.getElementById("btn-koreksi-hapus");
  const selectContainer = document.getElementById("koreksi-pegawai-select-container");
  const infoEl = document.getElementById("koreksi-pegawai-info");
  const selectEl = document.getElementById("koreksi-pegawai-select");

  if (titleEl) titleEl.textContent = "Input Koreksi Presensi Baru";
  if (subEl) subEl.textContent = "Catat atau perbaiki kehadiran pegawai yang mengalami kendala teknis atau dinas";
  if (submitTextEl) submitTextEl.textContent = "Simpan Koreksi Presensi";
  if (hapusBtn) hapusBtn.classList.add("hidden");

  if (infoEl) infoEl.classList.add("hidden");
  if (selectContainer) selectContainer.classList.remove("hidden");

  if (selectEl) {
    selectEl.innerHTML = "";
    let users = DB.getUsers();
    if (currentUser.role === "admin_desa") {
      users = users.filter(u => u.namaKantor === currentUser.namaKantor);
    }
    if (users.length === 0) {
      selectEl.innerHTML = `<option value="">-- Belum ada data pegawai terdaftar --</option>`;
    } else {
      users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.nik;
        opt.textContent = `${u.nama} (${u.nik}) - ${u.jabatan} [${u.namaKantor}]`;
        selectEl.appendChild(opt);
      });
    }
  }

  try {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    document.getElementById("koreksi-waktu").value = localISO;
  } catch(e) {
    document.getElementById("koreksi-waktu").value = "";
  }

  document.getElementById("koreksi-tipe-baru").value = "Masuk (Tepat Waktu)";
  document.getElementById("koreksi-lokasi").value = "Dikoreksi Admin (Valid)";
  document.getElementById("koreksi-alasan").value = "Koreksi presensi manual oleh admin";

  document.getElementById("modal-koreksi-absen").classList.remove("hidden");
}

function openModalKoreksi(id) {
  activeKoreksiId = id;
  const records = DB.getAttendance();
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  const titleEl = document.getElementById("modal-koreksi-title");
  const subEl = document.getElementById("modal-koreksi-subtitle");
  const submitTextEl = document.getElementById("btn-koreksi-submit-text");
  const hapusBtn = document.getElementById("btn-koreksi-hapus");
  const selectContainer = document.getElementById("koreksi-pegawai-select-container");
  const infoEl = document.getElementById("koreksi-pegawai-info");

  if (titleEl) titleEl.textContent = "Koreksi Presensi Pegawai";
  if (subEl) subEl.textContent = "Ubah status kehadiran, waktu presensi, atau hapus rekaman";
  if (submitTextEl) submitTextEl.textContent = "Simpan Perubahan";
  if (hapusBtn) hapusBtn.classList.remove("hidden");

  if (selectContainer) selectContainer.classList.add("hidden");
  if (infoEl) {
    infoEl.classList.remove("hidden");
    infoEl.textContent = `${rec.nama} (NIK: ${rec.nik}) • ${rec.namaKantor}`;
  }

  // Pre-fill datetime-local
  if (rec.timestamp) {
    try {
      const dt = new Date(rec.timestamp);
      const offset = dt.getTimezoneOffset() * 60000;
      const localISO = new Date(dt.getTime() - offset).toISOString().slice(0, 16);
      document.getElementById("koreksi-waktu").value = localISO;
    } catch(e) {
      document.getElementById("koreksi-waktu").value = "";
    }
  } else {
    document.getElementById("koreksi-waktu").value = "";
  }

  document.getElementById("koreksi-tipe-baru").value = rec.tipe || "Masuk (Tepat Waktu)";
  document.getElementById("koreksi-lokasi").value = rec.statusLokasi || "Valid di Radius (0m)";

  let cleanKet = rec.keterangan || "";
  if (cleanKet.startsWith("Catatan Koreksi: ")) cleanKet = cleanKet.replace("Catatan Koreksi: ", "");
  document.getElementById("koreksi-alasan").value = cleanKet;

  document.getElementById("modal-koreksi-absen").classList.remove("hidden");
}

function closeModalKoreksi() {
  document.getElementById("modal-koreksi-absen").classList.add("hidden");
}

function submitKoreksi(e) {
  e.preventDefault();
  const tipeBaru = document.getElementById("koreksi-tipe-baru").value;
  const waktuBaru = document.getElementById("koreksi-waktu").value;
  const lokasiBaru = document.getElementById("koreksi-lokasi").value.trim();
  const alasan = document.getElementById("koreksi-alasan").value.trim();

  const timestampVal = waktuBaru ? new Date(waktuBaru).toISOString() : new Date().toISOString();
  const statusLokasiVal = lokasiBaru || `Dikoreksi Admin (${currentUser.nama})`;
  const keteranganVal = alasan ? `Catatan Koreksi: ${alasan}` : `Dikoreksi Admin (${currentUser.nama})`;

  if (activeKoreksiId) {
    // Mode Edit
    const updateData = {
      tipe: tipeBaru,
      statusLokasi: statusLokasiVal,
      keterangan: keteranganVal,
      timestamp: timestampVal
    };
    DB.updateAttendance(activeKoreksiId, updateData);
    closeModalKoreksi();
    playChime(true);
    Swal.fire({
      icon: 'success',
      title: 'Koreksi Berhasil Disimpan',
      text: 'Perubahan presensi telah tersimpan.',
      timer: 1500,
      showConfirmButton: false
    });
  } else {
    // Mode Buat Baru
    const selectEl = document.getElementById("koreksi-pegawai-select");
    const selectedNik = selectEl ? selectEl.value : "";
    if (!selectedNik) {
      Swal.fire('Perhatian', 'Silakan pilih pegawai terlebih dahulu!', 'warning');
      return;
    }

    const users = DB.getUsers();
    const user = users.find(u => String(u.nik) === String(selectedNik));
    if (!user) {
      Swal.fire('Error', 'Pegawai yang dipilih tidak ditemukan!', 'error');
      return;
    }

    const newRecord = {
      id: "ATT-" + Date.now(),
      nik: user.nik,
      nama: user.nama,
      jabatan: user.jabatan,
      namaKantor: user.namaKantor,
      tipe: tipeBaru,
      timestamp: timestampVal,
      statusLokasi: statusLokasiVal,
      keterangan: keteranganVal,
      photoUrl: ""
    };

    DB.addAttendance(newRecord);
    closeModalKoreksi();
    playChime(true);
    Swal.fire({
      icon: 'success',
      title: 'Koreksi Presensi Berhasil Dibuat',
      text: `Data presensi untuk ${user.nama} berhasil dicatat.`,
      timer: 1500,
      showConfirmButton: false
    });
  }

  renderKoreksiTable();
  if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof filterLaporan === 'function') filterLaporan();
}

function deletePresensiConfirm(id) {
  if (String(id).startsWith("ABSENT-")) {
    Swal.fire({
      title: 'Hapus Data Tidak Hadir (Alpa)?',
      text: 'Status Tidak Hadir ini akan dihapus dari rekapitulasi laporan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus Data',
      cancelButtonText: 'Batal'
    }).then(result => {
      if (result.isConfirmed) {
        if (typeof DB !== 'undefined' && DB.addDeletedAbsent) {
          DB.addDeletedAbsent(id);
        }
        laporanPagination.selectedIds.delete(String(id));
        playChime(true);
        Swal.fire({
          icon: 'success',
          title: 'Berhasil Dihapus',
          text: 'Data Tidak Hadir (Alpa) telah dihapus dari laporan.',
          timer: 1500,
          showConfirmButton: false
        });
        filterLaporan();
      }
    });
    return;
  }

  const records = DB.getAttendance();
  const rec = records.find(r => r.id === id);
  const infoPegawai = rec ? `${rec.nama} (${rec.tipe})` : 'Data presensi ini';

  Swal.fire({
    title: 'Hapus Data Presensi?',
    text: `Apakah Anda yakin ingin menghapus data presensi ${infoPegawai}? Tindakan ini tidak dapat dibatalkan.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus Data',
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      if (activeKoreksiId === id) {
        closeModalKoreksi();
      }
      DB.deleteAttendance(id);
      koreksiPagination.selectedIds.delete(String(id));
      laporanPagination.selectedIds.delete(String(id));
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Presensi Berhasil Dihapus',
        text: 'Data presensi telah dihapus dari sistem.',
        timer: 1500,
        showConfirmButton: false
      });
      renderKoreksiTable();
      if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof filterLaporan === 'function') filterLaporan();
    }
  });
}

function deleteActiveKoreksi() {
  if (activeKoreksiId) {
    deletePresensiConfirm(activeKoreksiId);
  }
}

// Tambah Pegawai (Manajemen Pegawai & User)
function renderPegawaiTable() {
  const container = document.getElementById("pegawai-table-tbody");
  if (!container) return;

  let users = DB.getUsers();
  if (currentUser.role === "admin_desa") {
    users = users.filter(u => u.namaKantor === currentUser.namaKantor);
  }

  container.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-xs";
    
    let roleBadge = "bg-slate-100 text-slate-700";
    if (u.role === "super_admin") roleBadge = "bg-rose-100 text-rose-700 font-bold";
    if (u.role === "admin_desa") roleBadge = "bg-blue-100 text-blue-700 font-bold";

    // Foto profil pegawai dibuat icon saja
    const avatarBadge = getAvatarBadge(u.foto, "w-9 h-9", "w-5 h-5");

    tr.innerHTML = `
      <td class="p-3">
        <div class="flex items-center space-x-3">
          ${avatarBadge}
          <div>
            <p class="font-bold text-slate-800">${u.nama}</p>
            <p class="text-[10px] text-slate-500">NIK: ${u.nik}</p>
          </div>
        </div>
      </td>
      <td class="p-3 text-slate-700 font-medium">${u.jabatan}</td>
      <td class="p-3 text-slate-600">${u.namaKantor}</td>
      <td class="p-3"><span class="px-2.5 py-1 rounded-full text-[10px] ${roleBadge}">${u.role.toUpperCase().replace('_', ' ')}</span></td>
      <td class="p-3">
        <div class="flex items-center space-x-2">
          <button onclick="editUser('${u.nik}')" class="text-blue-600 hover:text-blue-800 font-semibold p-1 cursor-pointer">Edit</button>
          ${u.nik !== currentUser.nik ? `<button onclick="deleteUserConfirm('${u.nik}')" class="text-rose-600 hover:text-rose-800 font-semibold p-1 cursor-pointer">Hapus</button>` : ''}
        </div>
      </td>
    `;
    container.appendChild(tr);
  });
}

function openModalTambahPegawai() {
  document.getElementById("user-form-title").textContent = "Tambah Pegawai / Pengguna Baru";
  document.getElementById("form-user-nik").value = "";
  document.getElementById("form-user-nik").readOnly = false;
  document.getElementById("form-user-nama").value = "";
  document.getElementById("form-user-jabatan").value = "";
  document.getElementById("form-user-password").value = "123456";
  
  // Populate office dropdown
  const selectKantor = document.getElementById("form-user-kantor");
  selectKantor.innerHTML = "";
  const offices = DB.getOffices();
  offices.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.namaKantor;
    opt.textContent = o.namaKantor;
    selectKantor.appendChild(opt);
  });

  if (currentUser.role === "admin_desa") {
    selectKantor.value = currentUser.namaKantor;
    selectKantor.disabled = true;
    document.getElementById("form-user-role").value = "user";
    document.getElementById("form-user-role").disabled = true;
  } else {
    selectKantor.disabled = false;
    document.getElementById("form-user-role").disabled = false;
  }

  document.getElementById("modal-pegawai-form").classList.remove("hidden");
}

function closeModalTambahPegawai() {
  document.getElementById("modal-pegawai-form").classList.add("hidden");
}

function submitUserForm(e) {
  e.preventDefault();
  const nik = document.getElementById("form-user-nik").value.trim();
  const nama = document.getElementById("form-user-nama").value.trim();
  const jabatan = document.getElementById("form-user-jabatan").value.trim();
  const namaKantor = document.getElementById("form-user-kantor").value;
  const role = document.getElementById("form-user-role").value;
  const password = document.getElementById("form-user-password").value.trim() || "123456";

  // Cek apakah user sedang diedit untuk mempertahankan foto custom jika ada
  const existingUsers = DB.getUsers();
  const existing = existingUsers.find(u => String(u.nik) === String(nik));
  let userFoto = "";
  if (existing && existing.foto && !existing.foto.includes("unsplash.com")) {
    userFoto = existing.foto;
  }

  const user = {
    nik,
    nama,
    jabatan,
    namaKantor,
    role,
    password,
    foto: userFoto // Foto profil pegawai baru default icon saja
  };

  DB.saveUser(user);
  closeModalTambahPegawai();
  playChime(true);
  Swal.fire({
    icon: 'success',
    title: 'Data Pegawai Berhasil Disimpan',
    timer: 1500,
    showConfirmButton: false
  });
  renderPegawaiTable();
}

function editUser(nik) {
  const users = DB.getUsers();
  const u = users.find(x => x.nik === nik);
  if (!u) return;

  openModalTambahPegawai();
  document.getElementById("user-form-title").textContent = "Edit Data Pegawai";
  document.getElementById("form-user-nik").value = u.nik;
  document.getElementById("form-user-nik").readOnly = true;
  document.getElementById("form-user-nama").value = u.nama;
  document.getElementById("form-user-jabatan").value = u.jabatan;
  document.getElementById("form-user-kantor").value = u.namaKantor;
  document.getElementById("form-user-role").value = u.role;
  document.getElementById("form-user-password").value = u.password;
}

function deleteUserConfirm(nik) {
  Swal.fire({
    title: 'Hapus Pegawai?',
    text: 'Data pengguna ini akan dihapus dari sistem presensi.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    confirmButtonText: 'Ya, Hapus'
  }).then(res => {
    if (res.isConfirmed) {
      DB.deleteUser(nik);
      playChime(true);
      renderPegawaiTable();
    }
  });
}

// -------------------------------------------------------------
// PENGATURAN SUPER ADMIN (PETA GPS TITIK LOKASI & JAM KERJA)
// -------------------------------------------------------------
function renderPengaturan() {
  renderKantorTable();
  initMapPicker();
}

function renderKantorTable() {
  const container = document.getElementById("kantor-table-tbody");
  if (!container) return;

  const offices = DB.getOffices();
  container.innerHTML = "";

  offices.forEach(o => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-xs";
    tr.innerHTML = `
      <td class="p-3 font-bold text-slate-800">${o.namaKantor}</td>
      <td class="p-3 text-slate-600">${o.lat}, ${o.lng}</td>
      <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold">${o.radius} meter</span></td>
      <td class="p-3 font-semibold text-emerald-700">${o.jamMasuk || '08:00'} - ${o.jamPulang || '16:00'}</td>
      <td class="p-3">
        <button onclick="editKantor('${o.id}')" class="text-blue-600 hover:text-blue-800 font-semibold mr-2">Edit</button>
        <button onclick="deleteKantorConfirm('${o.id}')" class="text-rose-600 hover:text-rose-800 font-semibold">Hapus</button>
      </td>
    `;
    container.appendChild(tr);
  });
}

function initMapPicker() {
  const mapContainer = document.getElementById("leaflet-map-picker");
  if (!mapContainer) return;

  if (mapPicker) {
    mapPicker.invalidateSize();
    return;
  }

  const defaultLat = 0.538120;
  const defaultLng = 122.261200;

  mapPicker = L.map('leaflet-map-picker').setView([defaultLat, defaultLng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(mapPicker);

  mapMarker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(mapPicker);
  mapCircle = L.circle([defaultLat, defaultLng], { radius: 100, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }).addTo(mapPicker);

  // Map click event to pick coordinates
  mapPicker.on('click', e => {
    updateMapMarker(e.latlng.lat, e.latlng.lng);
  });

  mapMarker.on('dragend', () => {
    const pos = mapMarker.getLatLng();
    updateMapMarker(pos.lat, pos.lng);
  });
}

function updateMapMarker(lat, lng) {
  const latStr = lat.toFixed(6);
  const lngStr = lng.toFixed(6);
  
  document.getElementById("kantor-lat-input").value = latStr;
  document.getElementById("kantor-lng-input").value = lngStr;

  mapMarker.setLatLng([lat, lng]);
  mapCircle.setLatLng([lat, lng]);
  mapPicker.panTo([lat, lng]);
}

function setRadiusCircle(radius) {
  if (mapCircle) {
    mapCircle.setRadius(radius);
  }
}

function useCurrentGpsForOffice() {
  if (userCoords && userCoords.lat) {
    updateMapMarker(userCoords.lat, userCoords.lng);
    playChime(true);
    Swal.fire({
      icon: 'info',
      title: 'Koordinat GPS Diterapkan',
      text: `${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)}`,
      timer: 1200,
      showConfirmButton: false
    });
  }
}

let activeEditKantorId = null;
function openModalKantor() {
  activeEditKantorId = null;
  document.getElementById("modal-kantor-title").textContent = "Tambah Kantor Desa & Lokasi Baru";
  document.getElementById("kantor-nama-input").value = "";
  document.getElementById("kantor-lat-input").value = userCoords.lat.toFixed(6);
  document.getElementById("kantor-lng-input").value = userCoords.lng.toFixed(6);
  document.getElementById("kantor-radius-input").value = 100;
  document.getElementById("kantor-jam-masuk-input").value = "08:00";
  document.getElementById("kantor-jam-pulang-input").value = "16:00";
  
  document.getElementById("modal-kantor-setup").classList.remove("hidden");
  setTimeout(() => {
    initMapPicker();
    updateMapMarker(userCoords.lat, userCoords.lng);
  }, 200);
}

function closeModalKantor() {
  document.getElementById("modal-kantor-setup").classList.add("hidden");
}

function submitKantorForm(e) {
  e.preventDefault();
  const nama = document.getElementById("kantor-nama-input").value.trim();
  const lat = document.getElementById("kantor-lat-input").value.trim();
  const lng = document.getElementById("kantor-lng-input").value.trim();
  const radius = parseInt(document.getElementById("kantor-radius-input").value, 10) || 100;
  const jamMasuk = document.getElementById("kantor-jam-masuk-input").value;
  const jamPulang = document.getElementById("kantor-jam-pulang-input").value;

  const office = {
    id: activeEditKantorId,
    namaKantor: nama,
    lat,
    lng,
    radius,
    jamMasuk,
    jamPulang,
    toleransi: 15
  };

  DB.saveOffice(office);
  closeModalKantor();
  playChime(true);
  Swal.fire({
    icon: 'success',
    title: 'Data Kantor Berhasil Disimpan!',
    timer: 1500,
    showConfirmButton: false
  });
  renderKantorTable();
}

function editKantor(id) {
  const offices = DB.getOffices();
  const o = offices.find(x => x.id === id);
  if (!o) return;

  activeEditKantorId = o.id;
  openModalKantor();
  document.getElementById("modal-kantor-title").textContent = "Edit Kantor Desa & Jam Kerja";
  document.getElementById("kantor-nama-input").value = o.namaKantor;
  document.getElementById("kantor-lat-input").value = o.lat;
  document.getElementById("kantor-lng-input").value = o.lng;
  document.getElementById("kantor-radius-input").value = o.radius;
  document.getElementById("kantor-jam-masuk-input").value = o.jamMasuk || "08:00";
  document.getElementById("kantor-jam-pulang-input").value = o.jamPulang || "16:00";
  
  setTimeout(() => {
    updateMapMarker(parseFloat(o.lat), parseFloat(o.lng));
    setRadiusCircle(o.radius);
  }, 300);
}

function deleteKantorConfirm(id) {
  Swal.fire({
    title: 'Hapus Kantor Desa?',
    text: 'Lokasi dan radius kantor desa ini akan dihapus dari konfigurasi.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    confirmButtonText: 'Ya, Hapus'
  }).then(res => {
    if (res.isConfirmed) {
      DB.deleteOffice(id);
      playChime(true);
      renderKantorTable();
    }
  });
}

// -------------------------------------------------------------
// LAPORAN & CETAK
// -------------------------------------------------------------
function renderLaporanView() {
  const selectKantor = document.getElementById("laporan-filter-kantor");
  selectKantor.innerHTML = `<option value="">-- Semua Unit Kantor Desa --</option>`;
  const offices = DB.getOffices();
  offices.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.namaKantor;
    opt.textContent = o.namaKantor;
    selectKantor.appendChild(opt);
  });

  if (currentUser.role === "admin_desa") {
    selectKantor.value = currentUser.namaKantor;
    selectKantor.disabled = true;
  } else {
    selectKantor.disabled = false;
  }

  // Set default dates
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  document.getElementById("laporan-filter-start").value = firstDay;
  document.getElementById("laporan-filter-end").value = today;

  onKantorFilterChange();
}

function onKantorFilterChange() {
  const selectKantor = document.getElementById("laporan-filter-kantor");
  const kantorVal = selectKantor ? selectKantor.value : "";
  const alamatInput = document.getElementById("laporan-kop-alamat");
  const jabatanInput = document.getElementById("laporan-ttd-jabatan");
  const namaInput = document.getElementById("laporan-ttd-nama");
  const nipInput = document.getElementById("laporan-ttd-nip");

  let kantorTarget = kantorVal;
  if (currentUser && currentUser.role === "admin_desa") {
    kantorTarget = currentUser.namaKantor;
  }

  if (!kantorTarget || kantorTarget.toLowerCase().includes("camat") || kantorTarget === "") {
    if (alamatInput) alamatInput.value = "Jalan Trans Sulawesi No. 01, Kecamatan Botumoito, Kabupaten Boalemo, Gorontalo 96264";
    if (jabatanInput) jabatanInput.value = "Camat Botumoito";
    if (namaInput) namaInput.value = (currentUser && currentUser.role === "super_admin" && currentUser.nama) ? currentUser.nama : "Drs. Hendra Puluhulawa, M.Si";
    if (nipInput) nipInput.value = (currentUser && currentUser.role === "super_admin" && currentUser.nik) ? currentUser.nik : "198501012010011001";
  } else {
    // Sesuai desa masing-masing
    const cleanDesa = kantorTarget.replace(/Kantor Desa /i, "").replace(/Desa /i, "").trim();
    if (alamatInput) alamatInput.value = `Jalan Trans Sulawesi, Desa ${cleanDesa}, Kecamatan Botumoito, Kabupaten Boalemo, Gorontalo 96264`;
    if (jabatanInput) jabatanInput.value = `Kepala Desa ${cleanDesa}`;

    // Cari kepala desa atau admin desa terdaftar di kantor tersebut
    const desaLeader = DB.getUsers().find(u => u.namaKantor === kantorTarget && (u.role === 'admin_desa' || (u.jabatan && u.jabatan.toLowerCase().includes('kepala desa'))));

    if (desaLeader) {
      if (namaInput) namaInput.value = desaLeader.nama;
      if (nipInput) nipInput.value = desaLeader.nik || "-";
      if (jabatanInput && desaLeader.jabatan) jabatanInput.value = desaLeader.jabatan;
    } else {
      if (namaInput) {
        if (currentUser && currentUser.role === "admin_desa" && currentUser.namaKantor === kantorTarget) {
          namaInput.value = currentUser.nama;
        } else {
          namaInput.value = `Kepala Desa ${cleanDesa}`;
        }
      }
      if (nipInput) {
        if (currentUser && currentUser.role === "admin_desa" && currentUser.namaKantor === kantorTarget) {
          nipInput.value = currentUser.nik || "-";
        } else {
          nipInput.value = "-";
        }
      }
    }
  }

  laporanPagination.currentPage = 1;
  laporanPagination.selectedIds.clear();
  filterLaporan();
}

// Helper untuk menyaring data laporan dan mendeteksi pegawai tidak hadir (alpa)
function getFilteredLaporanRecords() {
  const selectKantor = document.getElementById("laporan-filter-kantor");
  const kantorFilter = selectKantor ? selectKantor.value : "";
  const start = document.getElementById("laporan-filter-start") ? document.getElementById("laporan-filter-start").value : "";
  const end = document.getElementById("laporan-filter-end") ? document.getElementById("laporan-filter-end").value : "";
  const showAlpaCheckbox = document.getElementById("laporan-show-alpa");
  const showAlpa = showAlpaCheckbox ? showAlpaCheckbox.checked : true;

  let records = DB.getAttendance();
  if (currentUser.role === "admin_desa") {
    records = records.filter(r => r.namaKantor === currentUser.namaKantor);
  } else if (kantorFilter) {
    records = records.filter(r => r.namaKantor === kantorFilter);
  }

  if (start && end) {
    records = records.filter(r => {
      const recDate = r.timestamp ? r.timestamp.slice(0, 10) : "";
      return recDate >= start && recDate <= end;
    });
  }

  if (!showAlpa) {
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return records;
  }

  // Cari seluruh pegawai terdaftar pada kantor yang sedang difilter
  let targetUsers = DB.getUsers();
  if (currentUser.role === "admin_desa") {
    targetUsers = targetUsers.filter(u => u.namaKantor === currentUser.namaKantor && u.role !== "super_admin");
  } else if (kantorFilter) {
    targetUsers = targetUsers.filter(u => u.namaKantor === kantorFilter && u.role !== "super_admin");
  } else {
    targetUsers = targetUsers.filter(u => u.role !== "super_admin");
  }

  const absentRecords = [];
  if (start && end && targetUsers.length > 0) {
    const dStart = new Date(start);
    const dEnd = new Date(end);
    const diffDays = Math.round((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;
    const deletedAbsents = (typeof DB !== 'undefined' && DB.getDeletedAbsents) ? DB.getDeletedAbsents() : [];

    if (diffDays >= 1 && diffDays <= 31) {
      for (let cur = new Date(dStart); cur <= dEnd; cur.setDate(cur.getDate() + 1)) {
        // Lewati hari Minggu (libur dinas resmi)
        if (cur.getDay() === 0) continue;
        const curDateStr = cur.toISOString().slice(0, 10);

        targetUsers.forEach(u => {
          const hasAttended = records.some(r => String(r.nik) === String(u.nik) && r.timestamp && r.timestamp.slice(0, 10) === curDateStr);
          const absentId = `ABSENT-${u.nik}-${curDateStr}`;
          if (!hasAttended && !deletedAbsents.includes(absentId)) {
            absentRecords.push({
              id: absentId,
              nik: u.nik,
              nama: u.nama,
              jabatan: u.jabatan,
              namaKantor: u.namaKantor,
              tipe: "Tidak Hadir (Alpa)",
              timestamp: `${curDateStr}T08:00:00`,
              statusLokasi: "Tidak Melakukan Presensi",
              keterangan: "Alpa / Tanpa Keterangan",
              isAbsent: true
            });
          }
        });
      }
    } else if (diffDays > 31) {
      // Rentang sangat panjang: tandai pegawai yang sama sekali tidak pernah hadir
      targetUsers.forEach(u => {
        const hasAny = records.some(r => String(r.nik) === String(u.nik));
        const absentId = `ABSENT-${u.nik}-range`;
        if (!hasAny && !deletedAbsents.includes(absentId)) {
          absentRecords.push({
            id: absentId,
            nik: u.nik,
            nama: u.nama,
            jabatan: u.jabatan,
            namaKantor: u.namaKantor,
            tipe: "Tidak Hadir (Alpa)",
            timestamp: `${end}T08:00:00`,
            statusLokasi: "Tidak Melakukan Presensi",
            keterangan: "Alpa pada rentang tanggal ini",
            isAbsent: true
          });
        }
      });
    }
  }

  const allRecords = [...records, ...absentRecords];
  allRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return allRecords;
}

// -------------------------------------------------------------
// LAPORAN STATE & HANDLERS (PAGINASI & HAPUS DATA)
// -------------------------------------------------------------
let laporanPagination = {
  currentPage: 1,
  perPage: 10,
  selectedIds: new Set()
};

function onLaporanFilterChange() {
  laporanPagination.currentPage = 1;
  laporanPagination.selectedIds.clear();
  filterLaporan();
}

function goToLaporanPage(page) {
  laporanPagination.currentPage = page;
  filterLaporan();
}

function changeLaporanPerPage(val) {
  laporanPagination.perPage = parseInt(val) || 10;
  laporanPagination.currentPage = 1;
  filterLaporan();
}

function toggleLaporanRowCheck(id, isChecked) {
  if (isChecked) {
    laporanPagination.selectedIds.add(String(id));
  } else {
    laporanPagination.selectedIds.delete(String(id));
  }
  updateLaporanSelectionUI();
}

function toggleSelectAllLaporan(isChecked) {
  const checkboxes = document.querySelectorAll(".laporan-row-check:not([disabled])");
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = cb.getAttribute("data-id");
    if (isChecked) {
      laporanPagination.selectedIds.add(String(id));
    } else {
      laporanPagination.selectedIds.delete(String(id));
    }
  });
  updateLaporanSelectionUI();
}

function updateLaporanSelectionUI() {
  const count = laporanPagination.selectedIds.size;
  const countEl = document.getElementById("laporan-selected-count");
  const containerEl = document.getElementById("laporan-selected-container");
  const btnDeleteSelected = document.getElementById("btn-laporan-delete-selected");
  const labelBtn = document.getElementById("label-laporan-delete-selected");
  const checkAll = document.getElementById("laporan-check-all");

  if (countEl) countEl.textContent = count;
  if (containerEl) {
    if (count > 0) containerEl.classList.remove("hidden");
    else containerEl.classList.add("hidden");
  }

  if (btnDeleteSelected) {
    btnDeleteSelected.disabled = (count === 0);
  }
  if (labelBtn) {
    labelBtn.textContent = count > 0 ? `Hapus yang Dipilih (${count})` : "Hapus yang Dipilih";
  }

  if (checkAll) {
    const checkboxes = document.querySelectorAll(".laporan-row-check:not([disabled])");
    if (checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked)) {
      checkAll.checked = true;
      checkAll.indeterminate = false;
    } else if (checkboxes.length > 0 && Array.from(checkboxes).some(cb => cb.checked)) {
      checkAll.checked = false;
      checkAll.indeterminate = true;
    } else {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    }
  }
}

function deleteSelectedLaporan() {
  const ids = Array.from(laporanPagination.selectedIds);
  if (ids.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Tidak Ada Data Terpilih',
      text: 'Silakan centang data presensi atau status tidak hadir yang ingin dihapus terlebih dahulu.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  Swal.fire({
    title: `Hapus ${ids.length} Data Terpilih?`,
    text: `Apakah Anda yakin ingin menghapus ${ids.length} data yang dipilih dari laporan? Data presensi dan status alpa akan dihapus.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: `Ya, Hapus (${ids.length}) Data`,
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      const realIds = ids.filter(i => !String(i).startsWith("ABSENT-"));
      const absentIds = ids.filter(i => String(i).startsWith("ABSENT-"));
      
      if (realIds.length > 0) DB.deleteMultipleAttendance(realIds);
      if (absentIds.length > 0 && typeof DB !== 'undefined' && DB.addDeletedAbsents) {
        DB.addDeletedAbsents(absentIds);
      }

      laporanPagination.selectedIds.clear();
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Dihapus',
        text: `${ids.length} data telah berhasil dihapus dari laporan.`,
        timer: 1500,
        showConfirmButton: false
      });
      filterLaporan();
      if (typeof renderKoreksiTable === 'function') renderKoreksiTable();
      if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  });
}

function deleteAllLaporan() {
  const records = getFilteredLaporanRecords();

  if (records.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Tidak Ada Data Laporan',
      text: 'Tidak ada data presensi atau status tidak hadir pada filter ini yang dapat dihapus.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  const selectKantor = document.getElementById("laporan-filter-kantor");
  const kantorText = selectKantor && selectKantor.value ? selectKantor.value : "Semua Unit Kantor";

  Swal.fire({
    title: 'Hapus SEMUA Data Laporan Terfilter?',
    html: `Apakah Anda yakin ingin menghapus <b>SEMUA</b> data presensi &amp; status tidak hadir (${records.length} data) untuk <b>${kantorText}</b> pada rentang tanggal ini?<br><br><span class="text-xs text-rose-600 font-bold">⚠️ Perhatian: Data presensi dan status alpa pada laporan ini akan dibersihkan!</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: `Ya, Hapus Semua (${records.length})`,
    cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      const realIds = records.filter(r => !String(r.id).startsWith("ABSENT-")).map(r => r.id);
      const absentIds = records.filter(r => String(r.id).startsWith("ABSENT-")).map(r => r.id);

      if (realIds.length > 0) DB.deleteMultipleAttendance(realIds);
      if (absentIds.length > 0 && typeof DB !== 'undefined' && DB.addDeletedAbsents) {
        DB.addDeletedAbsents(absentIds);
      }

      laporanPagination.selectedIds.clear();
      laporanPagination.currentPage = 1;
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Semua Data Terhapus',
        text: `${records.length} data laporan telah berhasil dibersihkan.`,
        timer: 1500,
        showConfirmButton: false
      });
      filterLaporan();
      if (typeof renderKoreksiTable === 'function') renderKoreksiTable();
      if (typeof renderRecentAttendance === 'function') renderRecentAttendance();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  });
}

function filterLaporan() {
  const container = document.getElementById("laporan-table-tbody");
  if (!container) return;

  const records = getFilteredLaporanRecords();
  
  // Update total count indicator
  const totalCountEl = document.getElementById("laporan-total-count");
  if (totalCountEl) totalCountEl.textContent = records.length;

  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 text-xs font-medium">Tidak ada data presensi atau pegawai terdaftar pada rentang tanggal ini.</td></tr>`;
    const pagInfo = document.getElementById("laporan-pagination-info");
    if (pagInfo) pagInfo.textContent = "Menampilkan 0 data";
    renderPaginationControls("laporan-pagination-controls", 1, 0, "goToLaporanPage");
    updateLaporanSelectionUI();
    return;
  }

  // Hitung Paginasi
  const totalRecords = records.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / laporanPagination.perPage));
  if (laporanPagination.currentPage > totalPages) laporanPagination.currentPage = totalPages;
  if (laporanPagination.currentPage < 1) laporanPagination.currentPage = 1;

  const startIndex = (laporanPagination.currentPage - 1) * laporanPagination.perPage;
  const endIndex = Math.min(startIndex + laporanPagination.perPage, totalRecords);
  const pageRecords = records.slice(startIndex, endIndex);

  const pagInfo = document.getElementById("laporan-pagination-info");
  if (pagInfo) {
    pagInfo.textContent = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalRecords} data`;
  }

  pageRecords.forEach(r => {
    const isAbsent = r.isAbsent || (r.tipe && (r.tipe.toLowerCase().includes("tidak hadir") || r.tipe.toLowerCase().includes("alpa")));
    const isChecked = laporanPagination.selectedIds.has(String(r.id));
    const tr = document.createElement("tr");
    const dateFormatted = new Date(r.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + " " + new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

    const checkboxHtml = `<input type="checkbox" class="laporan-row-check cursor-pointer rounded w-4 h-4 text-rose-600 focus:ring-rose-500" data-id="${r.id}" ${isChecked ? 'checked' : ''} onchange="toggleLaporanRowCheck('${r.id}', this.checked)">`;

    const deleteBtnHtml = `<button onclick="deletePresensiConfirm('${r.id}')" title="Hapus Data Ini" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
    </button>`;

    if (isAbsent) {
      tr.className = `${isChecked ? 'bg-rose-100/90 ' : 'bg-rose-50/80 '}hover:bg-rose-100 transition border-b border-rose-200 text-xs font-semibold text-rose-950`;
      tr.innerHTML = `
        <td class="p-3 text-center">${checkboxHtml}</td>
        <td class="p-3 text-rose-700 whitespace-nowrap font-bold">${dateFormatted}</td>
        <td class="p-3">
          <span class="font-bold text-rose-950">${r.nama}</span>
          <span class="text-[10px] text-rose-600 block font-medium">NIK: ${r.nik}</span>
        </td>
        <td class="p-3 text-rose-900">${r.jabatan}</td>
        <td class="p-3 text-rose-900">${r.namaKantor}</td>
        <td class="p-3">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse"></span>
            ${r.tipe}
          </span>
        </td>
        <td class="p-3 text-rose-700 font-medium">${r.statusLokasi}</td>
        <td class="p-3 text-center">${deleteBtnHtml}</td>
      `;
    } else {
      tr.className = `${isChecked ? 'bg-rose-50/60 ' : ''}hover:bg-slate-50 transition border-b border-slate-100 text-xs text-slate-800`;
      tr.innerHTML = `
        <td class="p-3 text-center">${checkboxHtml}</td>
        <td class="p-3 whitespace-nowrap font-medium text-slate-700">${dateFormatted}</td>
        <td class="p-3">
          <span class="font-bold text-slate-900">${r.nama}</span>
          <span class="text-[10px] text-slate-500 block">NIK: ${r.nik}</span>
        </td>
        <td class="p-3 text-slate-700">${r.jabatan}</td>
        <td class="p-3 text-slate-700">${r.namaKantor}</td>
        <td class="p-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">${r.tipe}</span></td>
        <td class="p-3 text-slate-500 font-medium">${r.statusLokasi}</td>
        <td class="p-3 text-center">${deleteBtnHtml}</td>
      `;
    }
    container.appendChild(tr);
  });

  renderPaginationControls("laporan-pagination-controls", laporanPagination.currentPage, totalPages, "goToLaporanPage");
  updateLaporanSelectionUI();
}

function printLaporan() {
  const kantorFilter = document.getElementById("laporan-filter-kantor") ? document.getElementById("laporan-filter-kantor").value : "";
  let kantorTarget = (currentUser.role === "admin_desa") ? currentUser.namaKantor : kantorFilter;

  // Set Kop Surat elements
  const kopKab = document.getElementById("print-kop-kab");
  const kopKec = document.getElementById("print-kop-kec");
  const kopDesa = document.getElementById("print-kop-desa");
  const kopAlamat = document.getElementById("print-kop-alamat");

  if (kopKab) kopKab.textContent = "PEMERINTAH KABUPATEN BOALEMO";
  if (kopKec) kopKec.textContent = "KECAMATAN BOTUMOITO";

  const customAlamat = document.getElementById("laporan-kop-alamat") ? document.getElementById("laporan-kop-alamat").value.trim() : "";

  if (!kantorTarget || kantorTarget.toLowerCase().includes("camat") || kantorTarget === "") {
    if (kopDesa) kopDesa.textContent = "KANTOR CAMAT BOTUMOITO";
    if (kopAlamat) kopAlamat.textContent = customAlamat || "Jalan Trans Sulawesi No. 01, Kecamatan Botumoito, Kabupaten Boalemo, Gorontalo 96264";
  } else {
    const cleanDesa = kantorTarget.replace(/Kantor Desa /i, "").replace(/Desa /i, "").trim().toUpperCase();
    if (kopDesa) kopDesa.textContent = `PEMERINTAH DESA ${cleanDesa}`;
    if (kopAlamat) kopAlamat.textContent = customAlamat || `Jalan Trans Sulawesi, Desa ${cleanDesa}, Kecamatan Botumoito, Kabupaten Boalemo, Gorontalo 96264`;
  }

  // Periode Laporan
  const startVal = document.getElementById("laporan-filter-start") ? document.getElementById("laporan-filter-start").value : "";
  const endVal = document.getElementById("laporan-filter-end") ? document.getElementById("laporan-filter-end").value : "";
  let periodeText = "Semua Riwayat Presensi";
  if (startVal && endVal) {
    const sStr = new Date(startVal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const eStr = new Date(endVal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    periodeText = `Periode: ${sStr} s/d ${eStr}`;
  }
  const periodeEl = document.getElementById("print-periode-laporan");
  if (periodeEl) periodeEl.textContent = periodeText;

  // Penandatangan
  const namaTtd = (document.getElementById("laporan-ttd-nama") ? document.getElementById("laporan-ttd-nama").value.trim() : "") || (currentUser.nama || "Drs. Hendra Puluhulawa, M.Si");
  const jabatanTtd = (document.getElementById("laporan-ttd-jabatan") ? document.getElementById("laporan-ttd-jabatan").value.trim() : "") || (currentUser.role === "admin_desa" ? "Kepala Desa" : "Camat Botumoito");
  const nipTtd = (document.getElementById("laporan-ttd-nip") ? document.getElementById("laporan-ttd-nip").value.trim() : "") || (currentUser.nik || "-");

  const printNama = document.getElementById("print-ttd-nama");
  const printJabatan = document.getElementById("print-ttd-jabatan");
  const printNip = document.getElementById("print-ttd-nip");

  if (printNama) printNama.textContent = namaTtd;
  if (printJabatan) printJabatan.textContent = jabatanTtd;
  if (printNip) {
    if (nipTtd && nipTtd !== "-") {
      printNip.textContent = (nipTtd.length >= 18 ? "NIP. " : "NIK. ") + nipTtd;
      printNip.style.display = "block";
    } else {
      printNip.textContent = "";
      printNip.style.display = "none";
    }
  }

  // Tanggal Hari Ini
  const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateTodayEl = document.getElementById("print-date-today");
  if (dateTodayEl) dateTodayEl.textContent = todayStr;

  // Salin baris ke print-report-tbody dengan border resmi cetak & penandaan warna merah bila tidak hadir
  const destTbody = document.getElementById("print-report-tbody");
  if (destTbody) {
    destTbody.innerHTML = "";
    const records = getFilteredLaporanRecords();

    if (records.length === 0) {
      destTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center border border-black text-xs font-medium">Tidak ada data presensi pada rentang waktu ini.</td></tr>`;
    } else {
      records.forEach((r, idx) => {
        const tr = document.createElement("tr");
        const isAbsent = r.isAbsent || (r.tipe && (r.tipe.toLowerCase().includes("tidak hadir") || r.tipe.toLowerCase().includes("alpa")));
        const dateFormatted = new Date(r.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + " " + new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
        
        if (isAbsent) {
          tr.setAttribute("style", "background-color: #fff1f2 !important; color: #b91c1c !important; font-weight: 600;");
          tr.innerHTML = `
            <td class="p-2 border border-black text-center text-xs" style="color: #b91c1c;">${idx + 1}</td>
            <td class="p-2 border border-black text-xs" style="color: #b91c1c;">${dateFormatted}</td>
            <td class="p-2 border border-black text-xs font-bold" style="color: #b91c1c;">${r.nama}<br><span class="text-[10px]" style="color: #991b1b;">NIK: ${r.nik}</span></td>
            <td class="p-2 border border-black text-xs" style="color: #b91c1c;">${r.jabatan}</td>
            <td class="p-2 border border-black text-xs" style="color: #b91c1c;">${r.namaKantor}</td>
            <td class="p-2 border border-black text-xs text-center font-black" style="color: #b91c1c; background-color: #ffe4e6 !important;">${r.tipe}</td>
            <td class="p-2 border border-black text-xs" style="color: #b91c1c;">${r.statusLokasi}${r.keterangan ? ' (' + r.keterangan + ')' : ''}</td>
          `;
        } else {
          tr.innerHTML = `
            <td class="p-2 border border-black text-center text-black text-xs">${idx + 1}</td>
            <td class="p-2 border border-black text-black text-xs">${dateFormatted}</td>
            <td class="p-2 border border-black text-black text-xs font-semibold">${r.nama}<br><span class="text-[10px] text-slate-700">NIK: ${r.nik}</span></td>
            <td class="p-2 border border-black text-black text-xs">${r.jabatan}</td>
            <td class="p-2 border border-black text-black text-xs">${r.namaKantor}</td>
            <td class="p-2 border border-black text-black text-xs text-center font-bold">${r.tipe}</td>
            <td class="p-2 border border-black text-black text-[11px]">${r.statusLokasi}${r.keterangan ? ' (' + r.keterangan + ')' : ''}</td>
          `;
        }
        destTbody.appendChild(tr);
      });
    }
  }

  // Tampilkan print area, cetak, lalu sembunyikan kembali
  const printArea = document.getElementById("printable-area");
  if (printArea) {
    printArea.classList.remove("hidden");
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        printArea.classList.add("hidden");
      }, 500);
    }, 150);
  } else {
    window.print();
  }
}

function exportExcel() {
  const records = getFilteredLaporanRecords();
  let csvContent = "\uFEFFWaktu,NIK,Nama,Jabatan,Kantor Desa,Tipe Presensi,Status Lokasi,Catatan\n";
  records.forEach(r => {
    const timeStr = `"${new Date(r.timestamp).toLocaleString('id-ID')}"`;
    const row = [timeStr, `"${r.nik}"`, `"${r.nama}"`, `"${r.jabatan}"`, `"${r.namaKantor}"`, `"${r.tipe}"`, `"${r.statusLokasi}"`, `"${r.keterangan || ''}"`];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Laporan_Absensi_Mo_eeya_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =============================================================
// DATABASE INTEGRATION: SHEET LAPORAN (ADMIN & SUPER ADMIN)
// =============================================================
async function exportToSheetLaporan() {
  const records = getFilteredLaporanRecords();
  if (!records || records.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Tidak Ada Data',
      text: 'Tidak ada data rekapan presensi yang sesuai dengan filter untuk disimpan ke Sheet Laporan.',
      confirmButtonColor: '#0f172a'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Simpan ke Sheet Laporan Database?',
    text: `Anda akan menyimpan ${records.length} data rekapan presensi ke Sheet "Laporan" di database Google Spreadsheet.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Simpan ke Spreadsheet',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  Swal.fire({
    title: 'Menyimpan Laporan ke Database...',
    text: `Sedang mengirim ${records.length} data ke sheet Laporan...`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await DB.saveLaporanToCloud(records);
    if (res && res.status === "success") {
      playChime(true);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Tersimpan ke Database!',
        text: `Data rekapan presensi (${records.length} baris) telah berhasil disimpan ke Sheet "Laporan" di Google Spreadsheet.`,
        confirmButtonColor: '#0f172a'
      });
    } else {
      throw new Error(res?.message || 'Gagal menyimpan ke Google Spreadsheet');
    }
  } catch (err) {
    playChime(false);
    const msg = String(err.message || err);
    if (msg.includes("saveLaporan") || msg.includes("Action tidak dikenali") || msg.includes("Invalid action")) {
      Swal.fire({
        icon: 'warning',
        title: 'Script Apps Script Perlu Di-Deploy Ulang',
        html: `
          <div class="text-left text-xs space-y-2 text-slate-700 leading-relaxed">
            <p>Aplikasi telah terhubung ke spreadsheet, namun <strong>Google Apps Script</strong> di akun Google Anda masih menjalankan versi lama yang belum mengaktifkan fitur <b>Sheet Laporan</b>.</p>
            <div class="bg-amber-50 p-2.5 rounded-xl border border-amber-200 space-y-1">
              <p class="font-bold text-amber-900">Cara Mengaktifkan (Hanya 1 Menit):</p>
              <ol class="list-decimal pl-4 space-y-1 text-amber-800">
                <li>Buka Google Spreadsheet <b>Mo'eeya</b>, klik menu <b>Ekstensi &gt; Apps Script</b>.</li>
                <li>Salin seluruh kode dari file <b>Kode.gs</b> di laptop ini, lalu tempelkan (paste) menimpa kode di Apps Script.</li>
                <li>Klik tombol <b>Simpan</b> (ikon disket).</li>
                <li>Pilih fungsi <b>initSheets</b> di dropdown atas, lalu klik <b>▷ Jalankan (Run)</b> agar Sheet Laporan langsung muncul.</li>
                <li>Klik <b>Terapkan (Deploy) &gt; Kelola Penerapan</b> &gt; klik <b>ikon Pensil (Edit)</b> &gt; pilih <b>Versi Baru</b> &gt; <b>Terapkan</b>.</li>
              </ol>
            </div>
          </div>
        `,
        confirmButtonColor: '#0f172a'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan Laporan',
        text: 'Terjadi kesalahan saat menyimpan ke Google Sheets: ' + msg,
        confirmButtonColor: '#0f172a'
      });
    }
  }
}

// =============================================================
// VALIDASI & PERSETUJUAN CUTI, IZIN, SAKIT (ADMIN & SUPER ADMIN)
// =============================================================
let validasiLeavePage = 1;
let validasiLeavePerPage = 10;

function renderValidasiLeave() {
  const tbody = document.getElementById("validasi-leave-table-tbody");
  if (!tbody) return;

  // Setup dropdown filter kantor
  const kantorSelect = document.getElementById("validasi-leave-filter-kantor");
  const offices = (typeof DB !== 'undefined' && DB.getOffices) ? DB.getOffices() : [];

  if (kantorSelect && kantorSelect.options.length <= 1) {
    const curVal = kantorSelect.value;
    kantorSelect.innerHTML = "";
    if (currentUser.role === "super_admin") {
      kantorSelect.innerHTML = `<option value="">-- Semua Kantor Desa --</option>`;
      offices.forEach(o => {
        kantorSelect.innerHTML += `<option value="${o.namaKantor}">${o.namaKantor}</option>`;
      });
      if (curVal) kantorSelect.value = curVal;
    } else {
      kantorSelect.innerHTML = `<option value="${currentUser.namaKantor}">${currentUser.namaKantor}</option>`;
      kantorSelect.disabled = true;
    }
  }

  const selectedKantor = kantorSelect ? kantorSelect.value : "";
  const selectedStatus = document.getElementById("validasi-leave-filter-status")?.value || "";
  const selectedTipe = document.getElementById("validasi-leave-filter-tipe")?.value || "";
  const search = (document.getElementById("validasi-leave-search")?.value || "").toLowerCase().trim();

  let allLeaves = (typeof DB !== 'undefined' && DB.getLeaves) ? DB.getLeaves() : [];

  // Admin Desa hanya melihat permohonan kantornya
  if (currentUser.role === "admin_desa") {
    allLeaves = allLeaves.filter(l => l.namaKantor === currentUser.namaKantor);
  } else if (selectedKantor) {
    allLeaves = allLeaves.filter(l => l.namaKantor === selectedKantor);
  }

  // Hitung Quick Stats
  const totalCount = allLeaves.length;
  const pendingCount = allLeaves.filter(l => (l.status || "Menunggu Persetujuan") === "Menunggu Persetujuan").length;
  const approvedCount = allLeaves.filter(l => l.status === "Disetujui").length;
  const rejectedCount = allLeaves.filter(l => l.status === "Ditolak").length;

  const statTotal = document.getElementById("stat-leave-total");
  const statPending = document.getElementById("stat-leave-pending");
  const statApproved = document.getElementById("stat-leave-approved");
  const statRejected = document.getElementById("stat-leave-rejected");
  if (statTotal) statTotal.textContent = totalCount;
  if (statPending) statPending.textContent = pendingCount;
  if (statApproved) statApproved.textContent = approvedCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Filter Status
  let filtered = allLeaves;
  if (selectedStatus) {
    filtered = filtered.filter(l => (l.status || "Menunggu Persetujuan") === selectedStatus);
  }
  // Filter Tipe
  if (selectedTipe) {
    filtered = filtered.filter(l => l.tipe === selectedTipe);
  }
  // Filter Pencarian
  if (search) {
    filtered = filtered.filter(l => 
      (l.nama && l.nama.toLowerCase().includes(search)) || 
      (l.nik && String(l.nik).includes(search)) ||
      (l.alasan && l.alasan.toLowerCase().includes(search))
    );
  }

  // Urutkan: Menunggu di atas, lalu tanggal terbaru
  filtered.sort((a, b) => {
    const isAPending = (a.status || "Menunggu Persetujuan") === "Menunggu Persetujuan";
    const isBPending = (b.status || "Menunggu Persetujuan") === "Menunggu Persetujuan";
    if (isAPending && !isBPending) return -1;
    if (!isAPending && isBPending) return 1;
    return new Date(b.created_at || b.id) - new Date(a.created_at || a.id);
  });

  // Paginasi
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / validasiLeavePerPage) || 1;
  if (validasiLeavePage > totalPages) validasiLeavePage = totalPages;
  if (validasiLeavePage < 1) validasiLeavePage = 1;

  const startIndex = (validasiLeavePage - 1) * validasiLeavePerPage;
  const pageItems = filtered.slice(startIndex, startIndex + validasiLeavePerPage);

  tbody.innerHTML = "";

  if (pageItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400 text-xs">
          Tidak ada data pengajuan izin/cuti/sakit yang sesuai filter.
        </td>
      </tr>
    `;
  } else {
    pageItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition border-b border-slate-100 text-xs";

      // Tag Tipe
      let tipeClass = "bg-amber-100 text-amber-800";
      if (item.tipe === "Sakit") tipeClass = "bg-rose-100 text-rose-800";
      if (item.tipe === "Cuti") tipeClass = "bg-purple-100 text-purple-800";

      // Status Badge
      const statusStr = item.status || "Menunggu Persetujuan";
      let statusBadge = "";
      if (statusStr === "Disetujui") {
        statusBadge = `
          <div>
            <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px]">
              <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Disetujui</span>
            </span>
            ${item.divalidasiOleh ? `<p class="text-[10px] text-slate-400 mt-0.5">Oleh: ${item.divalidasiOleh}</p>` : ''}
            ${item.catatanAdmin ? `<p class="text-[10px] text-emerald-700 italic mt-0.5">"${item.catatanAdmin}"</p>` : ''}
          </div>
        `;
      } else if (statusStr === "Ditolak") {
        statusBadge = `
          <div>
            <span class="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[11px]">
              <svg class="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>Ditolak</span>
            </span>
            ${item.divalidasiOleh ? `<p class="text-[10px] text-slate-400 mt-0.5">Oleh: ${item.divalidasiOleh}</p>` : ''}
            ${item.catatanAdmin ? `<p class="text-[10px] text-rose-700 italic mt-0.5">Alasan: "${item.catatanAdmin}"</p>` : ''}
          </div>
        `;
      } else {
        statusBadge = `
          <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[11px] animate-pulse">
            <svg class="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Menunggu</span>
          </span>
        `;
      }

      // Tombol Surat / Bukti
      let suratHtml = `<span class="text-slate-400 text-[11px] italic">Tanpa Berkas</span>`;
      if (item.surat) {
        suratHtml = `
          <button type="button" onclick="viewSuratModal('${item.surat.replace(/'/g, "\\'")}', '${(item.suratNama || 'Surat Bukti').replace(/'/g, "\\'")}', 'Surat Pengajuan ${item.tipe} - ${item.nama}')" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 shadow-2xs inline-flex items-center gap-1 cursor-pointer transition">
            <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>Lihat Surat</span>
          </button>
        `;
      }

      // Tombol Aksi
      let aksiHtml = "";
      if (statusStr === "Menunggu Persetujuan") {
        aksiHtml = `
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="approveLeave('${item.id}')" title="Setujui Permohonan" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Setujui</span>
            </button>
            <button type="button" onclick="rejectLeave('${item.id}')" title="Tolak Permohonan" class="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 cursor-pointer transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              <span>Tolak</span>
            </button>
          </div>
        `;
      } else {
        aksiHtml = `
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" onclick="approveLeave('${item.id}')" title="Ubah ke Disetujui" class="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
            <button type="button" onclick="rejectLeave('${item.id}')" title="Ubah ke Ditolak" class="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <button type="button" onclick="deleteLeaveRecord('${item.id}')" title="Hapus Data Pengajuan" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        `;
      }

      const createdDateFormatted = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

      tr.innerHTML = `
        <td class="p-3 font-medium text-slate-600 whitespace-nowrap">${createdDateFormatted}</td>
        <td class="p-3">
          <p class="font-bold text-slate-900">${item.nama}</p>
          <p class="text-[10px] text-slate-400">NIK: ${item.nik} • ${item.namaKantor || '-'}</p>
        </td>
        <td class="p-3">
          <span class="font-extrabold text-[10px] px-2 py-0.5 rounded-full ${tipeClass}">${item.tipe}</span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="font-semibold text-slate-700">${item.tglMulai}</span>
          <span class="text-slate-400 mx-1">s/d</span>
          <span class="font-semibold text-slate-700">${item.tglSelesai}</span>
        </td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${item.alasan || ''}">
          ${item.alasan || '-'}
        </td>
        <td class="p-3 text-center whitespace-nowrap">${suratHtml}</td>
        <td class="p-3 whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${aksiHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderValidasiLeavePagination(totalFiltered, totalPages);
}

function renderValidasiLeavePagination(totalFiltered, totalPages) {
  const infoEl = document.getElementById("validasi-leave-pagination-info");
  const controlsEl = document.getElementById("validasi-leave-pagination-controls");
  if (!infoEl || !controlsEl) return;

  const startItem = totalFiltered === 0 ? 0 : (validasiLeavePage - 1) * validasiLeavePerPage + 1;
  const endItem = Math.min(validasiLeavePage * validasiLeavePerPage, totalFiltered);
  infoEl.textContent = `Menampilkan ${startItem} - ${endItem} dari ${totalFiltered} data`;

  controlsEl.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.disabled = validasiLeavePage <= 1;
  prevBtn.className = `px-2.5 py-1 rounded-lg border text-xs font-semibold ${validasiLeavePage <= 1 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'}`;
  prevBtn.innerHTML = `&lt; Prev`;
  prevBtn.onclick = () => goToValidasiLeavePage(validasiLeavePage - 1);
  controlsEl.appendChild(prevBtn);

  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && Math.abs(p - validasiLeavePage) > 2 && p !== 1 && p !== totalPages) {
      if (controlsEl.lastChild && controlsEl.lastChild.textContent !== "...") {
        const dot = document.createElement("span");
        dot.className = "px-1 text-slate-400";
        dot.textContent = "...";
        controlsEl.appendChild(dot);
      }
      continue;
    }
    const pageBtn = document.createElement("button");
    const isCur = p === validasiLeavePage;
    pageBtn.className = `w-7 h-7 rounded-lg text-xs font-bold transition ${isCur ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'}`;
    pageBtn.textContent = p;
    pageBtn.onclick = () => goToValidasiLeavePage(p);
    controlsEl.appendChild(pageBtn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.disabled = validasiLeavePage >= totalPages;
  nextBtn.className = `px-2.5 py-1 rounded-lg border text-xs font-semibold ${validasiLeavePage >= totalPages ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'}`;
  nextBtn.innerHTML = `Next &gt;`;
  nextBtn.onclick = () => goToValidasiLeavePage(validasiLeavePage + 1);
  controlsEl.appendChild(nextBtn);
}

function changeValidasiLeavePerPage(val) {
  validasiLeavePerPage = parseInt(val) || 10;
  validasiLeavePage = 1;
  renderValidasiLeave();
}

function goToValidasiLeavePage(p) {
  validasiLeavePage = p;
  renderValidasiLeave();
}

async function approveLeave(id) {
  const leaves = DB.getLeaves();
  const leave = leaves.find(l => l.id === id);
  if (!leave) return;

  const { value: catatan } = await Swal.fire({
    title: `Setujui Permohonan ${leave.tipe}?`,
    text: `Pengajuan ${leave.tipe} oleh ${leave.nama} (${leave.tglMulai} s/d ${leave.tglSelesai}) akan disetujui resmi dan dicatat otomatis ke log presensi.`,
    icon: 'question',
    input: 'text',
    inputLabel: 'Catatan Persetujuan (Opsional)',
    inputPlaceholder: 'Contoh: Disetujui sesuai surat dokter yang dilampirkan.',
    showCancelButton: true,
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Setujui',
    cancelButtonText: 'Batal'
  });

  if (catatan !== undefined) {
    DB.updateLeaveStatus(id, "Disetujui", catatan, currentUser.nama);
    playChime(true);
    buildNavigation();
    renderValidasiLeave();
    Swal.fire({
      icon: 'success',
      title: 'Permohonan Disetujui!',
      text: `Permohonan ${leave.tipe} telah disetujui dan disinkronkan ke database Google Spreadsheet.`,
      timer: 1800,
      showConfirmButton: false
    });
  }
}

async function rejectLeave(id) {
  const leaves = DB.getLeaves();
  const leave = leaves.find(l => l.id === id);
  if (!leave) return;

  const { value: alasanPenolakan } = await Swal.fire({
    title: `Tolak Permohonan ${leave.tipe}?`,
    text: `Tentukan alasan penolakan untuk ${leave.nama}:`,
    icon: 'warning',
    input: 'text',
    inputLabel: 'Alasan Penolakan',
    inputPlaceholder: 'Contoh: Berkas surat bukti tidak jelas / tidak sah.',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Tolak Permohonan',
    cancelButtonText: 'Batal',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Alasan penolakan wajib diisi!';
      }
    }
  });

  if (alasanPenolakan) {
    DB.updateLeaveStatus(id, "Ditolak", alasanPenolakan.trim(), currentUser.nama);
    playChime(false);
    buildNavigation();
    renderValidasiLeave();
    Swal.fire({
      icon: 'info',
      title: 'Permohonan Ditolak',
      text: `Status telah diubah menjadi Ditolak dan disinkronkan ke database Google Spreadsheet.`,
      timer: 1800,
      showConfirmButton: false
    });
  }
}

async function deleteLeaveRecord(id) {
  const result = await Swal.fire({
    title: 'Hapus Rekaman Pengajuan?',
    text: 'Data permohonan ini akan dihapus secara permanen dari database.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (result.isConfirmed) {
    DB.deleteLeave(id);
    buildNavigation();
    renderValidasiLeave();
    Swal.fire({
      icon: 'success',
      title: 'Data Dihapus',
      text: 'Data permohonan telah dihapus.',
      timer: 1500,
      showConfirmButton: false
    });
  }
}

// Widget Kalender Samping
function initCalendarWidget() {
  const container = document.getElementById("widget-calendar-days");
  if (!container) return;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  container.innerHTML = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEl = document.createElement("div");
    const isToday = d === currentDay;
    dayEl.className = `w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition ${
      isToday ? 'bg-slate-900 text-white font-bold shadow-md' : 'text-slate-600 hover:bg-slate-100'
    }`;
    dayEl.textContent = d;
    container.appendChild(dayEl);
  }
}

// Database Google Sheets Connection Handlers
function openModalDatabaseConfig() {
  const input = document.getElementById("cfg-webapp-url");
  if (input) input.value = API.getUrl();
  document.getElementById("modal-database-config").classList.remove("hidden");
}

function closeModalDatabaseConfig() {
  document.getElementById("modal-database-config").classList.add("hidden");
}

async function saveAndSyncDatabase() {
  const input = document.getElementById("cfg-webapp-url");
  const url = input ? input.value.trim() : "";
  API.setUrl(url);

  Swal.fire({
    title: 'Menghubungkan ke Google Sheets...',
    text: 'Sedang menarik data dari spreadsheet...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  const success = await DB.syncFromCloud(false);
  closeModalDatabaseConfig();

  if (success) {
    playChime(true);
    Swal.fire({
      icon: 'success',
      title: 'Database Terhubung!',
      text: 'Data berhasil disinkronkan dengan Google Sheets.',
      timer: 1800,
      showConfirmButton: false
    });
    if (currentUser) {
      if (currentTab === 'pegawai') renderPegawaiTable();
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'koreksi') renderKoreksiTable();
      if (currentTab === 'pengaturan') renderPengaturan();
      if (currentTab === 'laporan') renderLaporanView();
    }
  } else {
    playChime(false);
    Swal.fire({
      icon: 'warning',
      title: 'Gagal Menghubungkan',
      text: 'Periksa URL Web App Google Apps Script Anda. Pastikan sudah di-deploy dengan akses "Anyone" (Siapa Saja).',
      confirmButtonColor: '#0f172a'
    });
  }
}

