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
            const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=40`;
            const avatarUrl = item.avatarUrl || fallbackAvatarUrl;
            
            nameTd.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; justify-content: inherit;">
                    <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255, 255, 255, 0.1);" />
                    <span>${name}</span>
                </div>
            `;
            
            const groupTd = document.createElement("td");
            groupTd.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: var(--primary);">${escapeHTML(item.groupName || item.groupId)}</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">${item.groupId}</span>
                </div>
            `;

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
    let isStreamPaused = true;
    if (btnToggleStream) {
        btnToggleStream.addEventListener("click", () => {
            isStreamPaused = !isStreamPaused;
            if (isStreamPaused) {
                btnToggleStream.textContent = "Bật Stream";
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

    // === REMINDER SETTINGS LOGIC ===
    const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const reminderTbody = document.getElementById("reminderTbody");
    const reminderForm = document.getElementById("reminderForm");
    const reminderGroupSelect = document.getElementById("reminderGroupId");

    loadReminders();
    loadGroups();
    loadReminderDefaults();

    async function loadGroups() {
        try {
            const res = await fetch("/api/groups");
            const groups = await res.json();
            if (reminderGroupSelect) {
                reminderGroupSelect.innerHTML = '<option value="">-- Chọn nhóm --</option>';
                groups.forEach(g => {
                    const opt = document.createElement("option");
                    opt.value = g.groupId;
                    opt.textContent = `${g.groupName} (${g.groupId})`;
                    reminderGroupSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Lỗi load groups:", e);
        }
    }

    async function loadReminderDefaults() {
        // Để trống, người dùng tự nhập
    }

    async function loadReminders() {
        try {
            const res = await fetch("/api/reminders");
            const data = await res.json();
            renderReminders(data);
        } catch (e) {
            console.error("Lỗi load reminders:", e);
        }
    }

    function renderReminders(list) {
        reminderTbody.innerHTML = "";
        if (!list || list.length === 0) {
            reminderTbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#94a3b8;'>Chưa có lịch nhắc nào được cài đặt.</td></tr>";
            return;
        }

        list.forEach(item => {
            const tr = document.createElement("tr");
            const isOnce = item.reminderType === "once";

            // Group name
            const groupTd = document.createElement("td");
            groupTd.innerHTML = `
                <div style="display:flex;flex-direction:column;">
                    <strong style="color:var(--primary,#38bdf8);">${escapeHTML(item.groupName || item.groupId)}</strong>
                    <span style="font-size:11px;color:#64748b;">${item.groupId}</span>
                </div>
            `;

            // Time range
            const timeTd = document.createElement("td");
            if (isOnce) {
                const h = String(item.startHour).padStart(2, "0");
                const m = String(item.startMinute).padStart(2, "0");
                timeTd.innerHTML = `<span class="days-badge" style="background:rgba(236,72,153,0.12);color:#ec4899;">📌 1 lần</span><br><span style="font-family:monospace;">${item.onceDate || "?"} ${h}:${m}</span>`;
            } else {
                const sh = String(item.startHour).padStart(2, "0");
                const sm = String(item.startMinute).padStart(2, "0");
                const eh = String(item.endHour).padStart(2, "0");
                const em = String(item.endMinute).padStart(2, "0");
                timeTd.innerHTML = `<span style="font-family:monospace;font-size:0.95rem;">${sh}:${sm} → ${eh}:${em}</span>`;
            }

            // Interval
            const intTd = document.createElement("td");
            intTd.textContent = isOnce ? "—" : (item.intervalMinutes + " phút");

            // Days
            const daysTd = document.createElement("td");
            if (isOnce) {
                daysTd.textContent = "—";
            } else {
                const days = (item.daysOfWeek || []).map(d => `<span class="days-badge">${DAY_NAMES[d] || d}</span>`).join(" ");
                daysTd.innerHTML = days || "—";
            }

            // Status
            const statusTd = document.createElement("td");
            if (item.enabled) {
                statusTd.innerHTML = `<span class="status-badge on">🟢 Bật</span>`;
            } else {
                statusTd.innerHTML = `<span class="status-badge off">🔴 Tắt</span>`;
            }

            // Actions
            const actionTd = document.createElement("td");
            actionTd.style.whiteSpace = "nowrap";

            const toggleBtn = document.createElement("button");
            toggleBtn.className = "btn-toggle";
            toggleBtn.textContent = item.enabled ? "Tắt" : "Bật";
            toggleBtn.onclick = () => toggleReminder(item.groupId, !item.enabled, item);

            const editBtn = document.createElement("button");
            editBtn.className = "btn-edit";
            editBtn.textContent = "Sửa";
            editBtn.onclick = () => fillReminderForm(item);

            const delBtn = document.createElement("button");
            delBtn.className = "btn-danger";
            delBtn.style.padding = "4px 10px";
            delBtn.style.fontSize = "0.8rem";
            delBtn.textContent = "Xóa";
            delBtn.onclick = () => removeReminder(item.groupId);

            actionTd.appendChild(toggleBtn);
            actionTd.appendChild(editBtn);
            actionTd.appendChild(delBtn);

            tr.appendChild(groupTd);
            tr.appendChild(timeTd);
            tr.appendChild(intTd);
            tr.appendChild(daysTd);
            tr.appendChild(statusTd);
            tr.appendChild(actionTd);

            reminderTbody.appendChild(tr);
        });
    }

    // Type toggle: show/hide fields
    const onceFields = document.getElementById("onceFields");
    const recurringFields = document.getElementById("recurringFields");
    const startMsgGroup = document.getElementById("startMsgGroup");
    document.querySelectorAll("input[name='reminderType']").forEach(radio => {
        radio.addEventListener("change", (e) => {
            const isOnce = e.target.value === "once";
            onceFields.style.display = isOnce ? "block" : "none";
            recurringFields.style.display = isOnce ? "none" : "block";
            startMsgGroup.style.display = isOnce ? "none" : "block";
        });
    });

    function fillReminderForm(item) {
        document.getElementById("reminderGroupId").value = item.groupId || "";

        const isOnce = item.reminderType === "once";
        document.querySelector(`input[name='reminderType'][value='${isOnce ? "once" : "recurring"}']`).checked = true;
        onceFields.style.display = isOnce ? "block" : "none";
        recurringFields.style.display = isOnce ? "none" : "block";
        startMsgGroup.style.display = isOnce ? "none" : "block";

        if (isOnce) {
            document.getElementById("reminderOnceDate").value = item.onceDate || "";
            document.getElementById("reminderOnceH").value = item.startHour ?? 20;
            document.getElementById("reminderOnceM").value = item.startMinute ?? 0;
        } else {
            document.getElementById("reminderStartH").value = item.startHour ?? 19;
            document.getElementById("reminderStartM").value = item.startMinute ?? 59;
            document.getElementById("reminderEndH").value = item.endHour ?? 20;
            document.getElementById("reminderEndM").value = item.endMinute ?? 5;
            document.getElementById("reminderInterval").value = item.intervalMinutes ?? 2;
        }

        document.getElementById("reminderMsg").value = item.reminderMessage || "";
        document.getElementById("reminderStartMsg").value = item.startMessage || "";

        const dayCheckboxes = document.querySelectorAll("#reminderDays input[type='checkbox']");
        dayCheckboxes.forEach(cb => {
            cb.checked = (item.daysOfWeek || []).includes(Number(cb.value));
        });

        document.getElementById("reminderForm").scrollIntoView({ behavior: "smooth" });
    }

    async function toggleReminder(groupId, newEnabled, existingItem) {
        try {
            const body = {
                groupId,
                enabled: newEnabled,
                reminderType: existingItem.reminderType || "recurring",
                onceDate: existingItem.onceDate || "",
                startHour: existingItem.startHour,
                startMinute: existingItem.startMinute,
                endHour: existingItem.endHour,
                endMinute: existingItem.endMinute,
                intervalMinutes: existingItem.intervalMinutes,
                daysOfWeek: existingItem.daysOfWeek,
                reminderMessage: existingItem.reminderMessage,
                startMessage: existingItem.startMessage
            };
            await fetch("/api/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            loadReminders();
        } catch (e) {
            alert("Lỗi: " + e.message);
        }
    }

    async function removeReminder(groupId) {
        if (!confirm("Bạn có chắc muốn xóa lịch nhắc của nhóm này?")) return;
        try {
            const res = await fetch("/api/reminders/" + groupId, { method: "DELETE" });
            const result = await res.json();
            if (result.success) {
                loadReminders();
            } else {
                alert("Lỗi: " + result.error);
            }
        } catch (e) {
            alert("Lỗi kết nối");
        }
    }

    if (reminderForm) {
        reminderForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const groupId = document.getElementById("reminderGroupId").value.trim();
            if (!groupId) return alert("Vui lòng chọn nhóm");

            const reminderType = document.querySelector("input[name='reminderType']:checked").value;
            const isOnce = reminderType === "once";

            let body;
            if (isOnce) {
                const onceDate = document.getElementById("reminderOnceDate").value;
                if (!onceDate) return alert("Vui lòng chọn ngày nhắc");
                body = {
                    groupId,
                    enabled: true,
                    reminderType: "once",
                    onceDate,
                    startHour: Number(document.getElementById("reminderOnceH").value),
                    startMinute: Number(document.getElementById("reminderOnceM").value),
                    endHour: 0,
                    endMinute: 0,
                    intervalMinutes: 1,
                    daysOfWeek: [],
                    reminderMessage: document.getElementById("reminderMsg").value,
                    startMessage: "",
                };
            } else {
                const daysOfWeek = [];
                document.querySelectorAll("#reminderDays input[type='checkbox']:checked").forEach(cb => {
                    daysOfWeek.push(Number(cb.value));
                });
                body = {
                    groupId,
                    enabled: true,
                    reminderType: "recurring",
                    onceDate: "",
                    startHour: Number(document.getElementById("reminderStartH").value),
                    startMinute: Number(document.getElementById("reminderStartM").value),
                    endHour: Number(document.getElementById("reminderEndH").value),
                    endMinute: Number(document.getElementById("reminderEndM").value),
                    intervalMinutes: Number(document.getElementById("reminderInterval").value),
                    daysOfWeek,
                    reminderMessage: document.getElementById("reminderMsg").value,
                    startMessage: document.getElementById("reminderStartMsg").value,
                };
            }

            try {
                const res = await fetch("/api/reminders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
                const result = await res.json();
                if (result.success) {
                    alert("✅ Đã lưu cấu hình nhắc nhở thành công!");
                    reminderForm.reset();
                    document.querySelector("input[name='reminderType'][value='recurring']").checked = true;
                    onceFields.style.display = "none";
                    recurringFields.style.display = "block";
                    startMsgGroup.style.display = "block";
                    document.querySelector("#reminderDays input[value='6']").checked = true;
                    document.querySelector("#reminderDays input[value='0']").checked = true;
                    loadReminderDefaults();
                    loadReminders();
                } else {
                    alert("Lỗi: " + result.error);
                }
            } catch (e) {
                alert("Lỗi kết nối server");
            }
        });
    }
});
