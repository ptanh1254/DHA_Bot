document.addEventListener("DOMContentLoaded", () => {
    // === TABS LOGIC ===
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // === ALIAS & COMMANDS LOGIC ===
    const form = document.getElementById("aliasForm");
    const tableBody = document.querySelector("#aliasTable tbody");

    async function loadAliases() {
        try {
            const res = await fetch("/api/aliases");
            const data = await res.json();
            renderTable(data);
        } catch (e) {
            console.error("Lỗi khi tải danh sách alias", e);
        }
    }

    function renderTable(data) {
        tableBody.innerHTML = "";
        if(!data || data.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#64748b; padding: 2rem;'>Chưa có lệnh nào được tạo.</td></tr>";
            return;
        }

        data.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="alias-badge">${item.alias}</span></td>
                <td><span class="cmd-badge">${item.originalCommand}</span></td>
                <td>${item.description || "-"}</td>
                <td>
                    <button class="btn-edit" data-alias="${item.alias}" data-original="${item.originalCommand}" data-desc="${item.description || ''}">Sửa</button>
                    <button class="btn-danger" data-id="${item._id}">Xóa</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll(".btn-danger").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                if (confirm("Bạn có chắc muốn xóa lệnh bí danh này?")) {
                    await fetch(`/api/aliases/${id}`, { method: "DELETE" });
                    loadAliases();
                }
            });
        });

        document.querySelectorAll(".btn-edit").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const alias = e.target.getAttribute("data-alias");
                const original = e.target.getAttribute("data-original");
                const desc = e.target.getAttribute("data-desc");
                
                document.getElementById("aliasInput").value = alias;
                document.getElementById("originalInput").value = original;
                document.getElementById("descInput").value = desc;
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
                document.getElementById("aliasInput").focus();
            });
        });
    }

    async function loadCommands() {
        try {
            const res = await fetch("/api/commands");
            const commands = await res.json();
            
            const grid = document.getElementById("commandsGrid");
            grid.innerHTML = "";
            
            commands.forEach(c => {
                const card = document.createElement("div");
                card.className = "cmd-card";
                card.innerHTML = `
                    <div style="flex-grow: 1;">
                        <strong>${c.cmd}</strong>
                        <p>${c.desc}</p>
                    </div>
                    <button class="btn-primary" style="padding: 0.5rem; font-size: 0.85rem;" data-cmd="${c.cmd}">+ Tạo Alias</button>
                `;
                grid.appendChild(card);
            });

            grid.querySelectorAll("button").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const cmd = e.target.getAttribute("data-cmd");
                    document.getElementById("originalInput").value = cmd;
                    document.getElementById("aliasInput").value = "";
                    document.getElementById("descInput").value = "";
                    
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    document.getElementById("aliasInput").focus();
                });
            });
        } catch (e) {
            console.error("Lỗi khi tải danh sách lệnh gốc", e);
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alias = document.getElementById("aliasInput").value;
        const originalCommand = document.getElementById("originalInput").value;
        const description = document.getElementById("descInput").value;

        try {
            const res = await fetch("/api/aliases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ alias, originalCommand, description })
            });
            const result = await res.json();
            if (result.success) {
                form.reset();
                loadAliases();
            } else {
                alert(result.error || "Có lỗi xảy ra");
            }
        } catch (err) {
            alert("Lỗi kết nối tới máy chủ");
        }
    });

    loadCommands();
    loadAliases();
    loadAutoKicks();

    // === AUTO KICK LOGIC ===
    const autokickTbody = document.getElementById("autokickTbody");

    async function loadAutoKicks() {
        try {
            const res = await fetch("/api/autokick");
            const data = await res.json();
            renderAutoKicks(data);
        } catch (e) {
            console.error("Lỗi khi load auto kick:", e);
        }
    }

    function renderAutoKicks(list) {
        autokickTbody.innerHTML = "";
        if (!list || list.length === 0) {
            autokickTbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Không có ai trong danh sách Auto Kick.</td></tr>";
            return;
        }

        list.forEach(item => {
            const tr = document.createElement("tr");
            
            const nameTd = document.createElement("td");
            const name = escapeHTML(item.lastKnownName || item.userId);
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=40`;
            
            nameTd.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; justify-content: inherit;">
                    <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.1);" />
                    <span>${name}</span>
                </div>
            `;
            
            const groupTd = document.createElement("td");
            groupTd.textContent = item.groupId;

            const kickedByTd = document.createElement("td");
            kickedByTd.textContent = item.lastKickedByName || item.lastKickedByUserId || "Auto";

            const timeTd = document.createElement("td");
            timeTd.textContent = item.lastKickAt ? new Date(item.lastKickAt).toLocaleString("vi-VN") : "N/A";

            const actionTd = document.createElement("td");
            const delBtn = document.createElement("button");
            delBtn.className = "btn-danger";
            delBtn.style.padding = "4px 8px";
            delBtn.textContent = "Xóa (Unban)";
            delBtn.onclick = () => removeAutoKick(item._id);
            actionTd.appendChild(delBtn);

            tr.appendChild(nameTd);
            tr.appendChild(groupTd);
            tr.appendChild(kickedByTd);
            tr.appendChild(timeTd);
            tr.appendChild(actionTd);

            autokickTbody.appendChild(tr);
        });
    }

    async function removeAutoKick(id) {
        if (!confirm("Bạn có chắc muốn xóa người này khỏi danh sách Auto Kick? (Họ sẽ có thể vào lại nhóm)")) return;
        try {
            const res = await fetch("/api/autokick/" + id, { method: "DELETE" });
            const result = await res.json();
            if (result.success) {
                alert("Đã xóa khỏi danh sách Auto Kick!");
                loadAutoKicks();
            } else {
                alert("Lỗi: " + result.error);
            }
        } catch (e) {
            alert("Lỗi kết nối");
        }
    }

    // === SOCKET.IO CHAT LOGIC ===
    const socket = io();
    const chatStream = document.getElementById("chatStream");
    const groupFilters = document.getElementById("groupFilters");
    const activeGroups = new Set(); // threadIds to show
    const knownGroups = new Set();  // all known threadIds
    
    function renderGroupFilters() {
        groupFilters.innerHTML = "";
        
        // Add "All Groups" option
        const allLabel = document.createElement("label");
        const allRadio = document.createElement("input");
        allRadio.type = "radio";
        allRadio.name = "groupFilter";
        allRadio.value = "all";
        allRadio.checked = activeGroups.has("all");
        allRadio.onchange = (e) => {
            if (e.target.checked) {
                activeGroups.clear();
                activeGroups.add("all");
                fetchStats("all");
            }
        };
        allLabel.appendChild(allRadio);
        allLabel.appendChild(document.createTextNode(" Tất cả các nhóm"));
        groupFilters.appendChild(allLabel);

        Array.from(knownGroups.values()).forEach(groupData => {
            if (groupData.id === "all") return;
            const label = document.createElement("label");
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "groupFilter";
            radio.value = groupData.id;
            radio.checked = activeGroups.has(groupData.id);
            radio.onchange = (e) => {
                if (e.target.checked) {
                    activeGroups.clear();
                    activeGroups.add(groupData.id);
                    fetchStats(groupData.id);
                }
            };
            label.appendChild(radio);
            label.appendChild(document.createTextNode(" " + groupData.name));
            groupFilters.appendChild(label);
        });
    }

    let currentStats = { totalDaily: 0, totalWeekly: 0, totalAllTime: 0 };
    async function fetchStats(groupId = "all") {
        try {
            const res = await fetch(`/api/stats?groupId=${groupId}`);
            currentStats = await res.json();
            updateStatsUI();
        } catch (e) {
            console.error("Lỗi fetch stats", e);
        }
    }

    function updateStatsUI() {
        document.getElementById("statDaily").textContent = currentStats.totalDaily || 0;
        document.getElementById("statWeekly").textContent = currentStats.totalWeekly || 0;
        if (document.getElementById("statMonthly")) {
            document.getElementById("statMonthly").textContent = currentStats.totalMonthly || 0;
        }
        document.getElementById("statTotal").textContent = currentStats.totalAllTime || 0;
    }

    // Override activeGroups init
    activeGroups.add("all");
    fetchStats("all");

    // Toggle stream
    const btnToggleStream = document.getElementById("btnToggleStream");
    let isStreamPaused = false;
    if (btnToggleStream) {
        btnToggleStream.addEventListener("click", () => {
            isStreamPaused = !isStreamPaused;
            if (isStreamPaused) {
                btnToggleStream.textContent = "Tiếp Tục";
                btnToggleStream.classList.add("paused");
            } else {
                btnToggleStream.textContent = "Tạm Dừng";
                btnToggleStream.classList.remove("paused");
            }
        });
    }

    function renderChatMessage(msg) {
        // Track new groups
        let found = false;
        for (const g of knownGroups) {
            if (g.id === msg.threadId) {
                found = true;
                break;
            }
        }
        if (!found) {
            knownGroups.add({ id: msg.threadId, name: msg.groupName || ("Nhóm " + msg.threadId) });
            renderGroupFilters();
        }

        // Check if we should render message
        if (isStreamPaused) return;
        if (!activeGroups.has("all") && !activeGroups.has(msg.threadId)) return;

        // Render message
        const div = document.createElement("div");
        div.className = "chat-msg";
        
        const time = new Date(msg.timestamp).toLocaleTimeString("vi-VN");
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.dName)}&background=random&color=fff&size=64`;
        const avatarUrl = msg.avatar || defaultAvatar;
        const groupName = msg.groupName || ("Nhóm " + msg.threadId);

        div.innerHTML = `
            <div class="chat-avatar">
                <img src="${avatarUrl}" alt="Avatar" onerror="this.onerror=null;this.src='${defaultAvatar}';" />
            </div>
            <div class="chat-content-body">
                <div class="chat-meta">
                    <span class="chat-sender">${escapeHTML(msg.dName)}</span>
                    <span class="chat-group">${escapeHTML(groupName)} &bull; ${time}</span>
                </div>
                <div class="chat-text">${escapeHTML(msg.text)}</div>
            </div>
        `;
        
        chatStream.appendChild(div);
        
        // Auto scroll
        if (chatStream.children.length > 100) {
            chatStream.removeChild(chatStream.firstChild);
        }
        chatStream.scrollTop = chatStream.scrollHeight;
    }

    // Load history
    async function loadChatHistory() {
        try {
            const res = await fetch("/api/chat-history");
            const data = await res.json();
            if (Array.isArray(data)) {
                data.forEach(msg => renderChatMessage(msg));
            }
        } catch (e) {
            console.error("Lỗi fetch chat history", e);
        }
    }
    loadChatHistory();

    // Live increment stats
    socket.on("chat_message", (msg) => {
        // Increment stats if applicable
        if (activeGroups.has("all") || activeGroups.has(msg.threadId)) {
            currentStats.totalDaily = (currentStats.totalDaily || 0) + 1;
            currentStats.totalWeekly = (currentStats.totalWeekly || 0) + 1;
            currentStats.totalMonthly = (currentStats.totalMonthly || 0) + 1;
            currentStats.totalAllTime = (currentStats.totalAllTime || 0) + 1;
            updateStatsUI();
        }
        renderChatMessage(msg);
    });

    function escapeHTML(str) {
        if (!str) return "";
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
