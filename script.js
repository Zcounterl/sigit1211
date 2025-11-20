import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, push, set, update, runTransaction, onDisconnect, serverTimestamp, get, remove, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyAYjnWMB23CQ2OnofJuoMBJyoxBahvPj9Q", 
    authDomain: "sigitdb-eb445.firebaseapp.com", 
    databaseURL: "https://sigitdb-eb445-default-rtdb.firebaseio.com/", 
    projectId: "sigitdb-eb445", 
    storageBucket: "sigitdb-eb445.firebasestorage.app", 
    messagingSenderId: "939882511814", 
    appId: "1:939882511814:web:797708c2440f35062646c7" 
};

const app = initializeApp(firebaseConfig); 
const rtdb = getDatabase(app);

// --- GLOBAL VARIABLES ---
let user = null;
let mediaRecorder; 
let audioChunks = [];
let curChatId = 'global'; 
let lastBroadcastId = localStorage.getItem('last_broadcast_id'); 
let curCollection = null; 
let curItem = null; 
let typingTimeout = null; 
let pendingImage = null; 
let replyingToMsg = null;
let chatListenerRef = null;

// --- TEMA & SESSION ---
const savedTheme = localStorage.getItem('site_theme') || '#6366f1'; 
document.documentElement.style.setProperty('--theme-color', savedTheme);

// Cek Session User
try {
    const saved = localStorage.getItem('user');
    if (saved) {
        user = JSON.parse(saved);
        // Perbaikan data tamu jika rusak
        if (user.isGuest && (!user.username || user.username === 'undefined')) {
            user.username = "Tamu_" + Math.floor(Math.random() * 1000); 
            user.name = user.username;
            localStorage.setItem('user', JSON.stringify(user));
        }
    }
} catch (e) { 
    localStorage.removeItem('user'); 
    user = null; 
}

// --- INITIALIZATION ---
window.onload = () => { 
    if(!user) {
        document.getElementById('login-modal').classList.remove('hidden'); 
    } else {
        initApp(); 
    }
    
    document.getElementById('btn-login-submit').addEventListener('click', doLogin); 
};

function initApp() {
    document.getElementById('login-modal').classList.add('hidden');
    
    if(!user.isGuest) {
        document.getElementById('nav-avatar').src = user.pic || `https://ui-avatars.com/api/?name=${user.username}`;
        
        if(user.role === 'developer') {
            document.getElementById('btn-god-mode').classList.remove('hidden');
        }
        
        if(user.chat_bg) {
            document.getElementById('chat-bg').style.backgroundImage = `url('${user.chat_bg}')`;
        }
    }
    
    setupListeners(); 
    navigateTo('home'); 
    
    // Inisialisasi Efek Visual
    VanillaTilt.init(document.querySelectorAll(".glass-card")); 
    
    if(Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    
    setTimeout(() => checkDeepLink(), 1500); 
    setupGodModeListeners(); 
    checkBanStatus(); 
    captureIp();
    
    // Particles Background
    particlesJS("particles-js", {"particles":{"number":{"value":50,"density":{"enable":true,"value_area":800}},"color":{"value":"#ffffff"},"shape":{"type":"circle","stroke":{"width":0,"color":"#000000"},"polygon":{"nb_sides":5},"image":{"src":"img/github.svg","width":100,"height":100}},"opacity":{"value":0.3,"random":false,"anim":{"enable":false,"speed":1,"opacity_min":0.1,"sync":false}},"size":{"value":3,"random":true,"anim":{"enable":false,"speed":40,"size_min":0.1,"sync":false}},"line_linked":{"enable":true,"distance":150,"color":"#ffffff","opacity":0.2,"width":1},"move":{"enable":true,"speed":2,"direction":"none","random":false,"straight":false,"out_mode":"out","bounce":false,"attract":{"enable":false,"rotateX":600,"rotateY":1200}}},"interactivity":{"detect_on":"canvas","events":{"onhover":{"enable":true,"mode":"grab"},"onclick":{"enable":true,"mode":"push"},"resize":true},"modes":{"grab":{"distance":140,"line_linked":{"opacity":0.5}},"bubble":{"distance":400,"size":40,"duration":2,"opacity":8,"speed":3},"repulse":{"distance":200,"duration":0.4},"push":{"particles_nb":4},"remove":{"particles_nb":2}}},"retina_detect":true});
}

// --- AUTH SYSTEM (LOGIN FIX) ---

async function doLogin() { 
    const uInput = document.getElementById('login-user').value.trim(); 
    const cInput = document.getElementById('login-code').value.trim(); 

    // Backdoor Developer
    if(uInput === 'developer' && cInput === 'dev123') { 
        user = {
            name:'Developer',
            username:'Developer',
            role:'developer',
            isPremium:true,
            pic:'https://cdn-icons-png.flaticon.com/512/2304/2304226.png'
        }; 
        localStorage.setItem('user', JSON.stringify(user)); 
        captureIp(); 
        location.reload(); 
        return; 
    } 

    try { 
        const snap = await get(ref(rtdb, `users/${uInput}`)); 
        
        if(snap.exists()) { 
            const dbData = snap.val();
            
            // Fix: Konversi ke String agar aman
            if(String(dbData.code) === String(cInput)) { 
                // Login Sukses
                const userData = snap.val(); 
                user = { ...userData, username: uInput, role: userData.role || 'member' }; 
                localStorage.setItem('user', JSON.stringify(user)); 
                captureIp(); 
                location.reload(); 
            } else { 
                Swal.fire("Gagal", "Kode Akses Salah!", "error"); 
            }
        } else { 
            Swal.fire("Gagal", "Username tidak ditemukan (Cek huruf besar/kecil)", "error"); 
        } 
    } catch(e) { 
        Swal.fire("Error", e.message, "error"); 
    } 
}

window.doGuest = () => { 
    const rnd = Math.floor(Math.random() * 1000); 
    user = { 
        name: "Tamu "+rnd, 
        username: "Tamu_"+rnd, 
        isGuest: true, 
        pic: "https://ui-avatars.com/api/?name=Tamu" 
    }; 
    localStorage.setItem('user', JSON.stringify(user)); 
    captureIp(); 
    location.reload(); 
}

window.logout = () => { 
    localStorage.removeItem('user'); 
    location.reload(); 
}

window.doPageLogin = async () => { 
    const uInput = document.getElementById('page-login-user').value.trim(); 
    const cInput = document.getElementById('page-login-code').value.trim(); 
    
    try { 
        const snap = await get(ref(rtdb, `users/${uInput}`)); 
        if(snap.exists()) { 
            const dbData = snap.val();
            if(String(dbData.code) === String(cInput)) { 
                user = { ...snap.val(), username: uInput, role: snap.val().role || 'member' }; 
                localStorage.setItem('user', JSON.stringify(user)); 
                captureIp(); 
                location.reload(); 
            } else {
                Swal.fire("Gagal", "Kode Akses Salah", "error"); 
            }
        } else { 
            Swal.fire("Gagal", "Username tidak ditemukan", "error"); 
        } 
    } catch(e) { 
        Swal.fire("Error", e.message, "error"); 
    } 
}

async function captureIp() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const json = await res.json();
        if(user && user.username) {
            const updates = {};
            updates[`users/${user.username}/ip`] = json.ip;
            updates[`users/${user.username}/last_seen`] = new Date().toISOString();
            updates[`users/${user.username}/device`] = navigator.userAgent;
            update(ref(rtdb), updates);
        }
    } catch(e) {}
}








// --- GANTI SATU BLOK FUNGSI INI ---

function setupListeners() {
    // 1. Config & Maintenance
    onValue(ref(rtdb, 'site_data/config'), s => { 
        try { 
            const c = s.val() || {}; 
            if(c.anti_ss) enableAntiSS(); 
            else disableAntiSS(); 
            
            if(user.role === 'developer') {
                const el = document.getElementById('anti-ss-toggle');
                if(el) el.checked = c.anti_ss;
            }
        } catch(e) {} 
    });

    onValue(ref(rtdb, 'site_data/maintenance'), s => {
        const m = s.val() || {};
        if(m.all && user.role !== 'developer') document.getElementById('lockdown-overlay').style.display = 'flex';
        else document.getElementById('lockdown-overlay').style.display = 'none';
        
        if(m.chat && user.role !== 'developer') { 
            document.getElementById('maintenance-chat').classList.remove('hidden'); 
            document.getElementById('chat-dash-content').classList.add('hidden'); 
        } else { 
            document.getElementById('maintenance-chat').classList.add('hidden'); 
            document.getElementById('chat-dash-content').classList.remove('hidden'); 
        }

        if(m.gallery && user.role !== 'developer') { 
            document.getElementById('maintenance-gallery').classList.remove('hidden'); 
            document.getElementById('gallery-container').classList.add('hidden'); 
        } else { 
            document.getElementById('maintenance-gallery').classList.add('hidden'); 
            document.getElementById('gallery-container').classList.remove('hidden'); 
        }
        
        if(user.role === 'developer') {
            ['all','chat','gallery','upload'].forEach(k => {
                const el = document.getElementById('mt-'+k);
                if(el) { if(m[k]) el.classList.add('toggle-active'); else el.classList.remove('toggle-active'); }
            });
        }
    });
    
    // 2. Gallery Data
    onValue(ref(rtdb, 'site_data/gallery'), s => { 
        document.getElementById('skeleton-loader').classList.add('hidden'); 
        document.getElementById('gallery-container').classList.remove('hidden'); 
        const d = s.val(); 
        if(!d) { 
            document.getElementById('gallery-container').innerHTML = '<div class="col-span-2 text-center text-gray-500 mt-10">Belum ada postingan galeri.</div>'; 
            return; 
        } 
        const items = Object.entries(d).map(([k,v]) => ({id:k, ...v})).sort((a,b) => (b.timestamp||0)-(a.timestamp||0)); 
        renderGallery(items); 
        renderSlider(items.filter(x => x.is_slide)); 
    });
    
    // 3. Other Data
    onValue(ref(rtdb, 'site_data/mading'), s => renderMading(s.val()));
    onValue(ref(rtdb, 'site_data/downloads'), s => renderDownloads(s.val()));
    onValue(ref(rtdb, 'site_data/playlist'), s => renderPlaylist(s.val()));
    
    // 4. Chat & Users
    loadChatMessages('global');
    
    onValue(ref(rtdb, 'users'), s => { 
        const allUsers = s.val() || {}; 
        renderContactList(allUsers); 
        if(user.role === 'developer') { renderAdminUserList(allUsers); } 
    });

    onValue(ref(rtdb, 'community/groups'), s => renderGroupList(s.val()));
    
    // 5. Presence System (Online Status)
    const con = ref(rtdb, ".info/connected"); 
    onValue(con, s => { 
        if(s.val() === true && !user.isGuest) { 
            const m = ref(rtdb, `status/online/${user.username}`); 
            onDisconnect(m).remove(); 
            set(m, {time: serverTimestamp()}); 
            if(user.role === 'developer') try{document.getElementById('stat-ping').innerText = "Online";}catch(e){} 
        } 
    });

    // --- [PERBAIKAN ERROR MERAH DI SINI] ---
    // Dulu pakai s.numChildren(), sekarang pakai s.size agar lebih aman
    onValue(ref(rtdb, "status/online"), s => {
        const count = s.exists() ? s.size : 0;
        document.getElementById('online-count').innerText = count;
    });
    
    // 6. Broadcast System
    onValue(ref(rtdb, 'site_data/config/broadcast'), (snap) => { 
        const data = snap.val(); 
        if (data && data.active && data.id !== lastBroadcastId) { 
            showGameToast("📢 " + data.message, "info"); 
            localStorage.setItem('last_broadcast_id', data.id); 
        } 
    });
}












// --- RENDERING FUNCTIONS ---

function renderGallery(items) { 
    const c = document.getElementById('gallery-container'); 
    c.innerHTML = ''; 
    
    items.forEach(i => { 
        const div = document.createElement('div'); 
        div.className = "glass-card cursor-pointer group relative"; 
        // FIX: Passing object 'i' agar tidak undefined
        div.onclick = function() { openDetail(i, 'site_data/gallery'); }; 
        
        div.innerHTML = `
            <div class="gallery-image-wrapper">
                <img src="${i.image}" class="gallery-card-img group-hover:scale-105 transition duration-500" loading="lazy">
                <div class="card-badge">${i.category || 'GALERI'}</div>
            </div>
            <div class="card-info">
                <h3 class="font-bold text-white text-sm truncate">${i.title || 'Tanpa Judul'}</h3>
                <p class="text-[10px] text-gray-400 line-clamp-2">${i.description || '...'}</p>
                <div class="text-[9px] text-gray-500 mt-1 text-right">${i.date}</div>
            </div>
        `; 
        c.appendChild(div); 
    }); 
    VanillaTilt.init(document.querySelectorAll(".glass-card")); 
}

function renderMading(d) { 
    const l = document.getElementById('mading-list'); 
    l.innerHTML = ''; 
    if(!d) { 
        l.innerHTML='<div class="text-gray-500 text-xs">Tidak ada info mading.</div>'; 
        return; 
    } 
    Object.entries(d).forEach(([k,m]) => { 
        const item = {id: k, ...m}; 
        const div = document.createElement('div'); 
        div.className = "glass-card p-5 rounded-2xl border-l-4 border-orange-500 cursor-pointer hover:border-orange-400"; 
        div.innerHTML = `
            <h3 class="font-bold text-white mb-1">${m.title}</h3>
            <p class="text-xs text-gray-400 line-clamp-2">${m.description}</p>
            <div class="mt-2 text-[10px] text-gray-500 italic">${m.date}</div>
        `; 
        div.onclick = function() { openDetail(item, 'site_data/mading'); }; 
        l.appendChild(div); 
    }); 
}

// GANTI FUNGSI renderSlider DENGAN INI:
function renderSlider(items) { 
    const w = document.getElementById('hero-slider'); 
    
    // Cek apakah ada item
    if (items && items.length > 0) {
        w.innerHTML = items.map(i => `<div class="swiper-slide"><img src="${i.image}" class="w-full h-full object-cover"></div>`).join('');
    } else {
        // Gambar Default jika kosong
        w.innerHTML = `<div class="swiper-slide"><img src="https://via.placeholder.com/800x400/1e293b/ffffff?text=Portal+Sekolah" class="w-full h-full object-cover"></div>`;
    }

    // Hanya aktifkan loop jika gambar lebih dari 1
    const enableLoop = items && items.length > 1;

    new Swiper(".mySwiper", { 
        loop: enableLoop, 
        autoplay: { delay: 4000, disableOnInteraction: false }, 
        pagination: { el: ".swiper-pagination", clickable: true }, 
        effect: 'fade' 
    }); 
}

function renderPlaylist(d) { 
    const l = document.getElementById('playlist-list'); 
    l.innerHTML = ''; 
    if(d) Object.entries(d).forEach(([k,v]) => {
        l.innerHTML += `
        <div onclick="playMusic('${v.src}','${v.title}','${v.artist}','${v.type}')" class="flex items-center gap-3 p-3 glass-card rounded-xl cursor-pointer hover:bg-white/5 transition">
            <div class="w-10 h-10 bg-indigo-600/20 rounded flex items-center justify-center text-indigo-400"><i class="fas fa-play"></i></div>
            <div><h4 class="text-sm font-bold text-white">${v.title}</h4><p class="text-xs text-gray-400">${v.artist}</p></div>
        </div>`; 
    });
}

function renderDownloads(d) { 
    const c = document.getElementById('downloads-grid'); 
    c.innerHTML = ''; 
    if(d) Object.values(d).forEach(f => {
        c.innerHTML += `
        <a href="${f.url}" target="_blank" class="glass-card p-4 rounded-xl flex items-center gap-3 hover:bg-white/5">
            <i class="fas fa-file-download text-green-400 text-lg"></i>
            <div><h4 class="text-sm font-bold text-white">${f.title}</h4><p class="text-[10px] text-gray-400">${f.type}</p></div>
        </a>`; 
    });
}

// --- CHAT SYSTEM (ROOMS & AVATARS) ---

window.switchChat = (id, name) => { 
    curChatId = id; 
    document.getElementById('chat-header-name').innerText = name; 
    loadChatMessages(id); 
    navigateTo('chat-room'); 
}

function loadChatMessages(chatId) { 
    const c = document.getElementById('chat-messages'); 
    c.innerHTML = '<div class="text-center text-gray-500 text-xs pt-4">Memuat pesan...</div>';
     
    if(chatListenerRef) off(chatListenerRef);
    chatListenerRef = ref(rtdb, `community/messages/${chatId}`);
     
    onValue(chatListenerRef, s => {
        c.innerHTML = '';
        const data = s.val();
        
        if(!data) { 
            c.innerHTML = '<div class="text-center text-gray-500 text-xs pt-10">Mulai obrolan baru.</div>'; 
            return; 
        }
         
        Object.values(data).slice(-50).forEach(m => {
            const isMe = m.username === user.username;
            const userPic = m.pic || `https://ui-avatars.com/api/?name=${m.username}&background=random`;
            
            let content = m.text;
            if(m.type === 'image_once') {
                 const isViewed = localStorage.getItem(`viewed_${m.id}`);
                 if(isViewed) content = `<div class="text-gray-500 italic text-xs"><i class="fas fa-eye-slash mr-1"></i> Foto hangus</div>`;
                 else content = `<img src="${m.text}" class="chat-image view-once-blur" onclick="viewOnce(this, '${m.id}')"><div class="text-[10px] text-red-400 mt-1"><i class="fas fa-bomb mr-1"></i> 1x Lihat</div>`;
            } else if(m.type === 'image') {
                 content = `<img src="${m.text}" class="chat-image" onclick="zoomImage('${m.text}')">`;
            } else if(m.type === 'audio') {
                 content = `<audio controls src="${m.text}" class="w-48 h-8 mt-1"></audio>`;
            }
             
            const rowClass = isMe ? 'chat-row me' : 'chat-row other';
            const bubbleClass = isMe ? 'chat-me' : 'chat-other';
             
            c.innerHTML += `
                <div class="${rowClass}">
                    <img src="${userPic}" class="chat-avatar-img">
                    <div class="chat-bubble ${bubbleClass}">
                        ${!isMe ? `<span class="chat-username-label">${m.username}</span>` : ''}
                        ${content}
                    </div>
                </div>
            `;
        });
        c.scrollTop = c.scrollHeight;
    });
}

window.sendMessage = () => { 
    const inp = document.getElementById('chat-input'); 
    const t = inp.value.trim(); 
    if(!t) return; 
    
    const pay = {
        text: t, 
        username: user.username, 
        pic: user.profile_pic || user.pic || `https://ui-avatars.com/api/?name=${user.username}`,
        type: 'text', 
        timestamp: serverTimestamp()
    }; 
    
    if(replyingToMsg) pay.replyTo = replyingToMsg; 
    
    push(ref(rtdb, `community/messages/${curChatId}`), pay).then(() => { 
        inp.value = ''; 
        replyingToMsg = null; 
        document.getElementById('reply-ui').classList.add('hidden'); 
        runTransaction(ref(rtdb, `users/${user.username}/xp`), x => (x||0)+5); 
    }); 
}

// --- AUDIO & MEDIA HANDLER ---

window.startRecording = () => { 
    navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
    }).then(stream => { 
        mediaRecorder = new MediaRecorder(stream); 
        mediaRecorder.start(); 
        audioChunks = []; 
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data); 
        
        document.getElementById('btn-mic').classList.add('text-red-500', 'animate-pulse'); 
        Toastify({text:"Merekam Audio HD...", duration:1000, gravity:"bottom"}).showToast(); 
    }); 
}

window.stopRecording = () => { 
    if(mediaRecorder && mediaRecorder.state !== 'inactive') { 
        mediaRecorder.stop(); 
        document.getElementById('btn-mic').classList.remove('text-red-500', 'animate-pulse'); 
        
        mediaRecorder.onstop = () => { 
            const blob = new Blob(audioChunks, { type: 'audio/webm' }); 
            const reader = new FileReader(); 
            reader.readAsDataURL(blob); 
            reader.onloadend = () => { 
                push(ref(rtdb, `community/messages/${curChatId}`), { 
                    username: user.username, 
                    pic: user.profile_pic || user.pic, 
                    text: reader.result, 
                    type: 'audio', 
                    timestamp: serverTimestamp() 
                }); 
            } 
        } 
    } 
}

window.sendImage = () => { 
    const isOnce = document.getElementById('check-view-once').checked; 
    push(ref(rtdb, `community/messages/${curChatId}`), { 
        username: user.username, 
        pic: user.profile_pic || user.pic, 
        text: pendingImage, 
        type: isOnce ? 'image_once' : 'image', 
        id: Date.now().toString(), 
        timestamp: serverTimestamp() 
    }); 
    cancelUpload(); 
}

window.viewOnce = (img, id) => { 
    img.classList.remove('view-once-blur'); 
    img.onclick = null; 
    setTimeout(() => { 
        img.src = "https://placehold.co/200x200/000/FFF?text=Expired"; 
        localStorage.setItem(`viewed_${id}`, true); 
    }, 5000); 
}

window.zoomImage = (src) => { 
    document.getElementById('media-zoom-content').src = src; 
    document.getElementById('media-zoom-modal').style.display = 'flex'; 
}

window.handleTyping = () => { 
    if(typingTimeout) clearTimeout(typingTimeout); 
    set(ref(rtdb, 'community/typing'), {user: user.username}); 
    typingTimeout = setTimeout(() => set(ref(rtdb, 'community/typing'), null), 2000); 
}

window.handleFileSelect = (input) => { 
    const file = input.files[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = (e) => { 
        pendingImage = e.target.result; 
        document.getElementById('preview-img').src = pendingImage; 
        document.getElementById('upload-preview').classList.remove('hidden'); 
    }; 
    reader.readAsDataURL(file); 
}

window.cancelUpload = () => { 
    pendingImage = null; 
    document.getElementById('upload-preview').classList.add('hidden'); 
    document.getElementById('chat-file-input').value = ''; 
}

window.replyMsg = (u,t) => { 
    replyingToMsg = {user:u, text:t}; 
    document.getElementById('reply-ui').classList.remove('hidden'); 
    document.getElementById('reply-user').innerText = u; 
    document.getElementById('reply-text').innerText = t; 
}

window.closeReply = () => { 
    replyingToMsg = null; 
    document.getElementById('reply-ui').classList.add('hidden'); 
}

// --- CONTACT & USER LISTS ---

function renderContactList(allUsers) { 
    const c = document.getElementById('member-list'); 
    c.innerHTML = ''; 
    const onlineRef = ref(rtdb, 'status/online');
    
    get(onlineRef).then(s => {
        const onlineData = s.val() || {};
        Object.values(allUsers).forEach(u => { 
            if(u.username && u.username !== user.username) { 
                const isUserOnline = onlineData[u.username] !== undefined;
                const indicatorColor = isUserOnline ? 'bg-green-500' : 'bg-red-500'; 
                const cid = [user.username, u.username].sort().join('_'); 
                
                c.innerHTML += `
                <div onclick="switchChat('${cid}', '${u.username}')" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer">
                    <div class="relative">
                        <img src="${u.profile_pic}" class="w-8 h-8 rounded-full bg-gray-800 object-cover">
                        <div class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${indicatorColor} border border-black"></div>
                    </div>
                    <div class="text-sm font-bold text-white">${u.username}</div>
                </div>`; 
            } 
        });
    });
}

function renderGroupList(groups) { 
    const c = document.getElementById('group-list'); 
    c.innerHTML = ''; 
    if(groups) Object.entries(groups).forEach(([k,g]) => {
        c.innerHTML += `<div onclick="switchChat('${k}', '${g.name}')" class="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"><div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs"><i class="fas fa-users"></i></div><div class="text-sm font-bold text-white">${g.name}</div></div>`; 
    });
}

function renderAdminUserList(users) { 
    const c = document.getElementById('admin-user-list'); 
    c.innerHTML = ''; 
    if(users === true) { 
        get(ref(rtdb, 'users')).then(snap => { 
            if(snap.exists()) renderAdminUserList(snap.val()); 
            else c.innerHTML = '<div class="text-gray-500 text-center text-xs">Tidak ada data.</div>'; 
        }); 
        return; 
    } 
    if(users) Object.entries(users).forEach(([k,u]) => { 
        const ip = u.ip || "Unknown"; 
        const device = u.device ? (u.device.includes("Android") ? "Android" : (u.device.includes("Windows") ? "Windows" : "Other")) : "-"; 
        c.innerHTML += `
        <div class="flex justify-between p-2 bg-white/5 rounded mb-1 items-center border border-white/5 hover:bg-white/10 transition">
            <div>
                <div class="text-xs font-bold text-white flex items-center gap-2">${u.username} <span class="px-1.5 py-0.5 rounded bg-blue-900 text-[8px] text-blue-200">${u.role||'Member'}</span></div>
                <div class="text-[10px] text-gray-400 font-mono mt-0.5">IP: ${ip} | ${device}</div>
            </div>
            <div class="flex gap-2">
                <button onclick="changeRank('${k}')" class="text-yellow-400 text-[10px] border border-yellow-500/30 px-2 py-1 rounded hover:bg-yellow-900/50">RANK</button>
                <button onclick="kickUser('${k}')" class="text-red-400 text-[10px] border border-red-500/30 px-2 py-1 rounded hover:bg-red-900/50">KICK</button>
            </div>
        </div>`; 
    }); 
}

// --- UPLOAD MODAL ---

window.openUploadModal = async (type) => { 
    const { value: method } = await Swal.fire({ 
        title: 'Pilih Metode Upload', 
        html: `<div class="grid grid-cols-2 gap-4"><div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-indigo-600" onclick="Swal.clickConfirm(); window.uploadMethod='url'"><i class="fas fa-link text-2xl mb-2 text-white"></i><br><span class="text-sm text-white font-bold">Link URL</span></div><div class="bg-white/10 p-4 rounded-xl cursor-pointer hover:bg-green-600" onclick="Swal.clickConfirm(); window.uploadMethod='file'"><i class="fas fa-file-upload text-2xl mb-2 text-white"></i><br><span class="text-sm text-white font-bold">File Lokal</span></div></div>`, 
        showConfirmButton: false, background: '#1e293b', color: '#fff' 
    }); 
    
    const selectedMethod = window.uploadMethod; 
    if(!selectedMethod) return; 
    
    let finalUrl = ""; 
    if(selectedMethod === 'url') { 
        const {value:url} = await Swal.fire({input:'url', inputLabel:'Link URL', background:'#1e293b', color:'#fff'}); 
        finalUrl = url; 
    } else { 
        const {value:file} = await Swal.fire({input:'file', inputLabel:'Pilih File', background:'#1e293b', color:'#fff'}); 
        if(file) finalUrl = await toBase64(file); 
    } 
    
    if(finalUrl) { 
        const {value:title} = await Swal.fire({input:'text', inputLabel:'Judul', background:'#1e293b', color:'#fff'}); 
        const {value:desc} = await Swal.fire({input:'textarea', inputLabel:'Deskripsi', background:'#1e293b', color:'#fff'}); 
        
        if(title) { 
            const d = {
                image: finalUrl, url: finalUrl, src: finalUrl, 
                title: title, description: desc, 
                date: moment().format('DD MMM'), 
                category: 'User Upload', 
                timestamp: serverTimestamp()
            }; 
            if(type==='gallery') d.is_slide=false; 
            if(type==='playlist') { d.type='audio'; d.artist='User Upload'; } 
            
            push(ref(rtdb, `site_data/${type}`), d); 
            Swal.fire("Sukses","","success"); 
        } 
    } 
}

const toBase64 = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error); });

// --- ADMIN ACTIONS ---

window.kickUser = (uid) => { if(confirm("Hapus User?")) remove(ref(rtdb, `users/${uid}`)); }
window.devSendBroadcast = () => { const msg = document.getElementById('dev-broadcast-msg').value; if(msg) set(ref(rtdb, 'site_data/config/broadcast'), {message:msg, active:true, id:Date.now().toString()}); }
window.toggleAntiSSDB = () => { const el = document.getElementById('anti-ss-toggle'); set(ref(rtdb, 'site_data/config/anti_ss'), el.checked); }
window.saveContactDev = () => { const wa = document.getElementById('edit-dev-wa').value; const tk = document.getElementById('edit-dev-tk').value; update(ref(rtdb, 'site_data/config/contact'), {wa: wa, tiktok: tk}); Swal.fire("Tersimpan","Kontak diperbarui","success"); }
window.editProfile = async (type) => { const {value:url} = await Swal.fire({input:'url', inputLabel: type==='pic'?'URL Foto Baru':'URL Wallpaper Chat (GIF/JPG)', background:'#1e293b', color:'#fff'}); if(url) { if(type==='pic') { update(ref(rtdb, `users/${user.username}`), {profile_pic: url}); user.pic = url; localStorage.setItem('user', JSON.stringify(user)); document.getElementById('p-avatar').src = url; } else { update(ref(rtdb, `users/${user.username}`), {chat_bg: url}); user.chat_bg = url; localStorage.setItem('user', JSON.stringify(user)); document.getElementById('chat-bg').style.backgroundImage = `url('${url}')`; } Swal.fire("Sukses","Diperbarui","success"); } }
window.createGroup = async () => { const {value:n} = await Swal.fire({input:'text',inputLabel:'Nama Grup',background:'#1e293b',color:'#fff'}); if(n) { const id=`grp_${Date.now()}`; await set(ref(rtdb,`community/groups/${id}`),{name:n,createdBy:user.username}); Swal.fire("OK","","success"); } }
window.toggleMaintenance = (type) => { get(ref(rtdb, `site_data/maintenance/${type}`)).then(s => { set(ref(rtdb, `site_data/maintenance/${type}`), !s.val()); }); }
window.changeRank = async (uid) => { const { value: role } = await Swal.fire({ title: 'Pilih Rank', input: 'select', inputOptions: { 'member': 'Member', 'moderator': 'Moderator', 'admin': 'Admin', 'vip': 'VIP', 'banned': 'Tahanan' }, inputPlaceholder: 'Pilih Role', showCancelButton: true, background: '#1e293b', color: '#fff' }); if (role) { update(ref(rtdb, `users/${uid}`), { role: role, rank: role.toUpperCase() }); showGameToast("Rank Updated!", "success"); } }

// --- DETAIL MODAL & COMMENTS ---

window.openDetail = (item, collection) => { 
    curItem = item; 
    curCollection = collection; 
    
    document.getElementById('modal-media').innerHTML = item.image || item.url ? `<img src="${item.image||item.url}" class="max-h-[50vh] object-contain">` : ''; 
    document.getElementById('modal-title').innerText = item.title || "Tanpa Judul"; 
    document.getElementById('modal-desc').innerText = item.description || "-"; 
    document.getElementById('modal-date').innerText = item.date; 
    document.getElementById('modal-author-pic').src = item.author_pic || "https://ui-avatars.com/api/?name=Admin"; 
    
    if(item.id) loadComments(item.id); 
    document.getElementById('detail-modal').classList.remove('hidden'); 
}

window.toggleDesc = () => { const d = document.getElementById('modal-desc'); const b = document.getElementById('btn-read-more'); if(d.classList.contains('expanded')) { d.classList.remove('expanded'); d.classList.add('line-clamp-2'); b.innerText = "... lihat selengkapnya"; } else { d.classList.add('expanded'); d.classList.remove('line-clamp-2'); b.innerText = "sembunyikan"; } }
window.toggleCommentSection = () => { const c = document.getElementById('comment-section'); c.classList.toggle('hidden'); if(!c.classList.contains('hidden')) { setTimeout(() => document.getElementById('comment-input').focus(), 300); const cont = document.querySelector('#detail-modal .custom-scroll'); cont.scrollTop = cont.scrollHeight; } }
window.deleteContent = () => { if(confirm("Hapus Permanen?")) { remove(ref(rtdb, `${curCollection}/${curItem.id}`)); document.getElementById('detail-modal').classList.add('hidden'); Swal.fire("Terhapus","","success"); } }
window.toggleLike = () => { const k=`liked_${curItem.id}`; const r=ref(rtdb,`posts/${curItem.id}/likes`); if(localStorage.getItem(k)) { runTransaction(r,v=>(v||0)-1); localStorage.removeItem(k); document.getElementById('modal-heart').className="far fa-heart text-xl"; } else { runTransaction(r,v=>(v||0)+1); localStorage.setItem(k,'1'); document.getElementById('modal-heart').className="fas fa-heart text-red-500 text-xl like-active"; } }

// --- MODERN MUSIC PLAYER (DYNAMIC ISLAND) ---
// GANTI FUNGSI playMusic DENGAN INI:
window.playMusic = (src, t, a, type) => { 
    const p = document.getElementById('sticky-player');
    
    // Update tampilan Player (Dan sertakan <audio> di dalamnya agar tidak hilang)
    p.innerHTML = `
        <img src="https://cdn-icons-png.flaticon.com/512/3844/3844724.png" class="music-cover-spin">
        <div class="music-info">
            <div class="music-title">${t}</div>
            <div class="music-artist">${a}</div>
        </div>
        <div class="visualizer playing">
            <div class="bar"></div><div class="bar"></div><div class="bar"></div>
        </div>
        <button onclick="togglePlay()" class="btn-play-modern"><i id="sp-icon" class="fas fa-pause"></i></button>
        <button onclick="closePlayer()" class="text-gray-500 hover:text-white ml-2"><i class="fas fa-times"></i></button>
        <audio id="audio-element" class="hidden"></audio> 
    `;
    
    p.classList.add('active'); 
    
    // Ambil elemen audio SETELAH dibuat ulang oleh innerHTML di atas
    const aud = document.getElementById('audio-element');
    if(aud) {
        aud.src = src; 
        aud.play().catch(e => showGameToast("Gagal memutar audio", "error")); 
    }
}
window.togglePlay = () => { const a=document.getElementById('audio-element'), viz = document.querySelector('.visualizer'), cov = document.querySelector('.music-cover-spin'); if(a.paused) { a.play(); document.getElementById('sp-icon').className="fas fa-pause"; if(viz) { viz.classList.remove('paused'); viz.classList.add('playing'); } if(cov) cov.classList.remove('paused'); } else { a.pause(); document.getElementById('sp-icon').className="fas fa-play"; if(viz) { viz.classList.remove('playing'); viz.classList.add('paused'); } if(cov) cov.classList.add('paused'); } }
window.closePlayer = () => { document.getElementById('audio-element').pause(); document.getElementById('sticky-player').classList.remove('active'); }

// --- NAVIGATION & UTILS ---

window.navigateTo = (p) => { 
    if(p==='admin' && user.role!=='developer') return Swal.fire("Access Denied","Developer Only","error"); 
    document.querySelectorAll('.view-section').forEach(e=>e.classList.add('hidden')); 
    document.getElementById('view-'+p).classList.remove('hidden'); 
    if(p==='profile') { 
        if(user.isGuest) { 
            document.getElementById('profile-guest-view').classList.remove('hidden'); 
            document.getElementById('profile-member-view').classList.add('hidden'); 
        } else { 
            document.getElementById('profile-guest-view').classList.add('hidden'); 
            document.getElementById('profile-member-view').classList.remove('hidden'); 
            document.getElementById('p-name').innerText = user.username; 
            document.getElementById('p-avatar').src = user.profile_pic; 
            if(user.role==='developer') document.getElementById('admin-panel-btn-container').classList.remove('hidden'); 
            onValue(ref(rtdb,`users/${user.username}`),s=>{const d=s.val();if(d){document.getElementById('p-xp').innerText=d.xp||0;document.getElementById('p-level').innerText=d.level||1;document.getElementById('p-rank').innerText=d.rank||"Pemula"}}); 
        } 
    } 
    document.querySelectorAll('.nav-item').forEach(b => {b.classList.remove('active'); b.querySelector('i').classList.remove('text-indigo-400');}); 
    const b = document.getElementById('nav-'+p); if(b) {b.classList.add('active'); b.querySelector('i').classList.add('text-indigo-400');} 
    window.scrollTo(0,0); 
}

window.sharePostLink = () => { if(!curItem) return; const link = `${window.location.origin}${window.location.pathname}?v=${curCollection}&id=${curItem.id}`; navigator.clipboard.writeText(link).then(() => Swal.fire({icon:'success',title:'Link Disalin!',timer:1500,showConfirmButton:false})); const refShare = ref(rtdb, `posts/${curItem.id}/shares`); runTransaction(refShare, (v) => (v || 0) + 1); }
window.checkDeepLink = async () => { const params = new URLSearchParams(window.location.search); const pId = params.get('id'); const pCol = params.get('v'); if (pId && pCol) { window.history.replaceState({}, document.title, window.location.pathname); try { const snap = await get(ref(rtdb, `${pCol}/${pId}`)); if (snap.exists()) { const item = {id: pId, ...snap.val()}; openDetail(item, pCol); } else { showGameToast("Postingan tidak ditemukan.", "error"); } } catch (e) { console.error(e); } } }

window.loadComments = (postId) => { 
    if(!postId) return; 
    const list = document.getElementById('comments-list'); 
    const refComm = ref(rtdb, `interactions/comments/${postId}`); 
    onValue(refComm, (snap) => { 
        list.innerHTML = ''; 
        const data = snap.val(); 
        if (!data) { 
            list.innerHTML = '<div class="text-center text-gray-500 text-xs mt-2">Belum ada komentar.</div>'; 
            document.getElementById('modal-comments-count').innerText = "0"; 
            return; 
        } 
        document.getElementById('modal-comments-count').innerText = Object.keys(data).length; 
        Object.values(data).forEach(c => { 
            const isMe = c.username === user.username; 
            const delBtn = isMe || user.role === 'developer' ? `<button onclick="delComment('${postId}','${c.id}')" class="ml-2 text-[10px] text-gray-500 hover:text-red-500"><i class="fas fa-trash"></i></button>` : ''; 
            const html = `<div class="flex gap-3 items-start group"><img src="${c.pic}" class="w-8 h-8 rounded-full bg-gray-800 object-cover flex-shrink-0"><div class="flex-1"><div class="text-sm text-white"><span class="font-bold mr-1 cursor-pointer hover:text-gray-300">${c.username}</span><span class="font-light text-gray-200">${c.text}</span></div><div class="flex gap-3 mt-1 text-[10px] text-gray-400 font-bold"><span>${moment(c.timestamp).fromNow(true)}</span><button class="hover:text-white" onclick="document.getElementById('comment-input').value='@${c.username} '; document.getElementById('comment-input').focus();">Balas</button>${delBtn}</div></div><button class="text-xs text-gray-500 hover:text-red-500 pt-1"><i class="far fa-heart"></i></button></div>`; 
            list.innerHTML += html; 
        }); 
    }); 
}

window.sendComment = () => { 
    if(!curItem || !curItem.id) { Swal.fire("Error", "ID Postingan tidak valid.", "error"); return; } 
    const input = document.getElementById('comment-input'); 
    const txt = input.value.trim(); 
    if(!txt) return; 
    const finalUsername = user.username || user.name || "User"; 
    const cId = Date.now().toString(); 
    const path = `interactions/comments/${curItem.id}/${cId}`; 
    const data = { id: cId, text: txt, username: finalUsername, pic: user.profile_pic || user.pic || "https://ui-avatars.com/api/?name=" + finalUsername, timestamp: serverTimestamp() }; 
    set(ref(rtdb, path), data).then(() => { input.value = ''; showGameToast("Terkirim", "success"); }).catch((e) => { Swal.fire("Gagal Kirim", e.message, "error"); }); 
}

window.delComment = (pId, cId) => { if(confirm("Hapus komentar?")) { remove(ref(rtdb, `interactions/comments/${pId}/${cId}`)); } }
window.closeDetailModal = () => { document.getElementById('detail-modal').classList.add('hidden'); document.getElementById('modal-media').innerHTML = ''; }

// --- GOD MODE ---
function setupGodModeListeners() {
    onValue(ref(rtdb, 'site_data/god_mode/command'), s => {
        const cmd = s.val(); if(!cmd) return;
        if(user.role === 'developer') {
            const btnMap = {'matrix':'btn-matrix', 'glitch':'btn-glitch', 'darkness':'btn-darkness', 'freeze':'btn-freeze', 'bsod':'btn-bsod'};
            Object.values(btnMap).forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('btn-god-active'); });
            if(cmd.type !== 'clear' && btnMap[cmd.type]) { const el = document.getElementById(btnMap[cmd.type]); if(el) el.classList.add('btn-god-active'); }
            return; 
        }
        const now = Date.now(); const duration = (cmd.duration || 10) * 1000;
        if(now - cmd.ts > duration) {
            stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness');
            document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none';
            document.body.style.overflow = 'auto'; return;
        }
        if(cmd.type === 'matrix') startMatrixEffect();
        if(cmd.type === 'glitch') document.body.classList.add('god-effect-glitch');
        if(cmd.type === 'darkness') document.body.classList.add('god-effect-darkness');
        if(cmd.type === 'freeze') { document.getElementById('freeze-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'bsod') { document.getElementById('bsod-overlay').style.display = 'block'; document.body.style.overflow = 'hidden'; }
        if(cmd.type === 'clear') { stopMatrixEffect(); document.body.classList.remove('god-effect-glitch', 'god-effect-darkness'); document.getElementById('freeze-overlay').style.display = 'none'; document.getElementById('bsod-overlay').style.display = 'none'; document.body.style.overflow = 'auto'; }
        if(cmd.type === 'redirect' && cmd.url) window.location.href = cmd.url;
    });

    onValue(ref(rtdb, 'site_data/god_mode/voice'), s => { const msg = s.val(); if(msg && msg.text && msg.id !== sessionStorage.getItem('last_voice_id')) { sessionStorage.setItem('last_voice_id', msg.id); if(user.role === 'developer') return; try { const u = new SpeechSynthesisUtterance(msg.text); u.lang = 'id-ID'; u.rate = 0.9; window.speechSynthesis.speak(u); } catch(e) {} } });
    onValue(ref(rtdb, 'site_data/god_mode/lockdown'), s => { if(s.val() === true) { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.add('btn-god-active'); if(user.role !== 'developer') document.getElementById('lockdown-overlay').style.display = 'flex'; } else { const btn = document.getElementById('btn-lockdown'); if(btn) btn.classList.remove('btn-god-active'); document.getElementById('lockdown-overlay').style.display = 'none'; } });
}

window.triggerGodEffect = (type) => { const dur = document.getElementById('god-duration').value || 10; set(ref(rtdb, 'site_data/god_mode/command'), {type: type, duration: parseInt(dur), ts: Date.now()}); showGameToast("Effect Broadcasted!", "success"); }
window.triggerLockdown = () => { get(ref(rtdb, 'site_data/god_mode/lockdown')).then(s => { const cur = s.val(); set(ref(rtdb, 'site_data/god_mode/lockdown'), !cur); showGameToast("Lockdown: " + (!cur), "warn"); }); }
window.sendVoiceOfGod = () => { const t = document.getElementById('god-msg-input').value; if(t) set(ref(rtdb, 'site_data/god_mode/voice'), {text: t, id: Date.now()}); }
window.triggerRedirect = () => { const u = document.getElementById('god-redirect-input').value; if(u) set(ref(rtdb, 'site_data/god_mode/command'), {type: 'redirect', url: u, ts: Date.now()}); }
window.banUser = () => { const u = document.getElementById('god-ban-input').value.trim(); if(u) { set(ref(rtdb, `site_data/banned_users/${u}`), true); showGameToast(u+" BANNED", "error"); } }
function checkBanStatus() { if(user && user.username) { onValue(ref(rtdb, `site_data/banned_users/${user.username}`), s => { if(s.val() === true) { document.body.innerHTML = ""; document.getElementById('banned-overlay').style.display = 'flex'; document.body.appendChild(document.getElementById('banned-overlay')); localStorage.setItem('is_banned', 'true'); } }); } }

let matrixInterval;
function startMatrixEffect() { const c = document.getElementById('god-layer-matrix'); const ctx = c.getContext('2d'); c.style.display = 'block'; c.width = window.innerWidth; c.height = window.innerHeight; const cols = Array(Math.floor(c.width/20)).fill(0); matrixInterval = setInterval(() => { ctx.fillStyle = '#0001'; ctx.fillRect(0,0,c.width,c.height); ctx.fillStyle = '#0f0'; ctx.font = '15pt monospace'; cols.forEach((y,i) => { const text = String.fromCharCode(Math.random()*128); ctx.fillText(text, i*20, y); cols[i] = y > 100 + Math.random()*10000 ? 0 : y + 20; }); }, 50); }
function stopMatrixEffect() { clearInterval(matrixInterval); document.getElementById('god-layer-matrix').style.display = 'none'; }

window.openTerminal = () => { document.getElementById('dev-terminal').classList.remove('hidden'); }
window.closeTerminal = () => { document.getElementById('dev-terminal').classList.add('hidden'); }
function logToTerm(msg, type='info') { const t = document.getElementById('term-output'); const time = new Date().toLocaleTimeString(); let colorClass = 'log-info'; if(type==='success') colorClass = 'log-success'; if(type==='warn') colorClass = 'log-warn'; if(type==='error') colorClass = 'log-error'; const row = document.createElement('div'); row.className = 'log-entry'; row.innerHTML = `<span class="log-time">[${time}]</span><span class="${colorClass}">${msg}</span>`; t.appendChild(row); t.scrollTop = t.scrollHeight; }
document.getElementById('term-input').addEventListener('keypress', (e)=>{ if(e.key === 'Enter'){ const cmd = e.target.value.trim(); logToTerm(`root# ${cmd}`, 'info'); if(cmd==='clear') document.getElementById('term-output').innerHTML=''; else if(cmd==='matrix on') triggerGodEffect('matrix'); else if(cmd==='matrix off') triggerGodEffect('clear'); else if(cmd==='exit') closeTerminal(); else logToTerm("Unknown cmd", "error"); e.target.value = ''; }});

function enableAntiSS() { document.getElementById('main-body').classList.add('no-select'); document.addEventListener('contextmenu', preventDefault); document.addEventListener('keydown', preventCapture); }
function disableAntiSS() { document.getElementById('main-body').classList.remove('no-select'); document.removeEventListener('contextmenu', preventDefault); document.removeEventListener('keydown', preventCapture); }
const preventDefault = e => e.preventDefault();
const preventCapture = e => { if (e.key === 'PrintScreen' || (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'Shift' || e.key === 'I'))) { e.preventDefault(); } };




// ==========================================
// 🐞 SISTEM DEBUG MANAJER V2 (MODERN)
// ==========================================
// Tempel ini di baris paling akhir script.js

const debugContainer = document.getElementById('debug-logs-container');
const MAX_LOGS = 300;
let currentFilter = 'ALL';

// Fungsi Nambah Log
function addLog(type, message, detail = '') {
    if (!debugContainer) return;

    const div = document.createElement('div');
    div.className = `log-item log-type-${type}`;
    // Tambahkan atribut data-type untuk filtering
    div.dataset.type = type; 
    
    // Logic Filter: Sembunyikan jika tidak sesuai filter aktif
    if (currentFilter !== 'ALL' && currentFilter !== type) {
        div.style.display = 'none';
    }

    const time = new Date().toLocaleTimeString().split(' ')[0];
    if (typeof message === 'object') { try { message = JSON.stringify(message, null, 2); } catch(e) { message = '[Object]'; } }

    div.innerHTML = `
        <div class="log-header">
            <span>${type}</span>
            <span>${time}</span>
        </div>
        <div class="log-content">${message}</div>
        ${detail ? `<div class="log-detail">${detail}</div>` : ''}
    `;

    // Auto Scroll jika user ada di bawah
    const isAtBottom = debugContainer.scrollHeight - debugContainer.scrollTop === debugContainer.clientHeight;
    debugContainer.appendChild(div);
    if (isAtBottom) debugContainer.scrollTop = debugContainer.scrollHeight;

    // Limit Logs
    if (debugContainer.childElementCount > MAX_LOGS) debugContainer.removeChild(debugContainer.firstChild);

    // Efek Visual Error di Tombol
    if (type === 'ERROR') {
        const btn = document.getElementById('debug-floating-btn');
        const badge = document.getElementById('debug-badge');
        if(btn) btn.classList.add('has-error-pulse');
        if(badge) badge.classList.remove('hidden');
    }
}

// Logic Filter Tab
window.filterLogs = (type) => {
    currentFilter = type;
    // Update UI Tombol
    document.querySelectorAll('.debug-tab').forEach(b => b.classList.remove('active'));
    if(type==='ALL') document.getElementById('tab-all').classList.add('active');
    else if(type==='LOG') document.getElementById('tab-log').classList.add('active');
    else if(type==='WARN') document.getElementById('tab-warn').classList.add('active');
    else if(type==='ERROR') document.getElementById('tab-error').classList.add('active');

    // Filter Elemen
    const logs = debugContainer.children;
    for (let log of logs) {
        if (type === 'ALL' || log.dataset.type === type) log.style.display = 'flex';
        else log.style.display = 'none';
    }
    // Auto scroll to bottom on filter change
    debugContainer.scrollTop = debugContainer.scrollHeight;
}

window.copyDebugLogs = () => {
    const text = debugContainer.innerText;
    navigator.clipboard.writeText(text).then(() => showGameToast("Log disalin!", "success"));
}

// Bajak Console
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function(...args) { originalLog(...args); if (isDev()) addLog('LOG', args.join(' ')); };
console.warn = function(...args) { originalWarn(...args); if (isDev()) addLog('WARN', args.join(' ')); };
console.error = function(...args) { originalError(...args); if (isDev()) addLog('ERROR', args.join(' ')); };

function isDev() {
    return user && (user.role === 'developer' || user.rank === 'GOD MODE' || user.username === 'sigit123');
}

document.addEventListener('click', (e) => {
    if (isDev()) {
        const target = e.target;
        const elName = target.tagName + (target.id ? `#${target.id}` : '') + (target.className ? `.${target.className.split(' ')[0]}` : '');
        addLog('ACTION', `Click: ${elName}`);
    }
}, true);

window.onerror = function(msg, url, lineNo) {
    if (isDev()) addLog('ERROR', 'CRASH', `${msg}\n@Line: ${lineNo}`);
    return false;
};

// UI Control (Fixed Hidden Logic)
window.toggleDebugPanel = () => {
    const panel = document.getElementById('debug-panel');
    const btn = document.getElementById('debug-floating-btn');
    const badge = document.getElementById('debug-badge');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        setTimeout(() => panel.classList.add('active'), 10);
        // Reset notifikasi error saat dibuka
        btn.classList.remove('has-error-pulse');
        badge.classList.add('hidden');
    } else {
        panel.classList.remove('active');
        setTimeout(() => panel.classList.add('hidden'), 300);
    }
}
window.clearDebugLogs = () => { if(debugContainer) debugContainer.innerHTML = ''; addLog('SYSTEM', 'Log Cleared.'); }
window.execDebugCmd = (input) => {
    const cmd = input.value; addLog('SYSTEM', 'Exec:', cmd);
    try { const result = eval(cmd); addLog('LOG', 'Result:', result); } catch (e) { addLog('ERROR', 'Exec Failed:', e.message); }
    input.value = '';
}

// Auto Init
setInterval(() => {
    const btn = document.getElementById('debug-floating-btn');
    if (btn && isDev()) btn.classList.remove('hidden');
}, 2000);
setTimeout(() => { if(isDev()) { addLog('SYSTEM', 'Debug V2 Ready.'); document.getElementById('debug-floating-btn').classList.remove('hidden'); } }, 1000);