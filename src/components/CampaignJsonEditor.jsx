// CampaignJsonEditor.jsx
import React, { useState, useRef, useEffect } from "react";
import "./CampaignJsonEditor.css";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

// ========== CONSTANTS ==========
const NUMBER_CFG_OPTIONS = [
  "SUCCESS_STP",
  "EXAM_COURSE_ID",
  "RATING",
  "ACCEPT_WEEK_DAY",
];

const RANGE_CFG_OPTIONS = [
  "DISTANCE",
  "ACCEPT_WEEK_DAY",
  "ACCEPT_MINUTE",
  "ACCEPT_TIME",
  "DEPOSIT_ACCOUNT",
  "FIRST_ACTIVATE_TIME",
  "FIRST_COMPLETE_TIME",
  "AMOUNT",
];

const POINT_TYPE_OPTIONS = [
  "ACTIVE_DAY",
  "SUCCESS_STP",
  "DISTANCE",
  "TRANSACTION",
  "SUPPLIER_PROFILE",
];

const STRING_CFG_OPTIONS = [
  "SERVICE_GROUP",
  "USER_PARTNER",
  "CITY",
  "DISTRICT",
  "WARD",
  "SOURCE",
  "TRANSACTION_TYPE",
];

// ========== UTILITIES ==========

// Epoch seconds/millis -> Date
function epochToDate(ts) {
  if (ts === null || ts === undefined || ts === "") return null;
  let num = Number(ts);
  if (Number.isNaN(num)) return null;
  if (num > 10000000000) {
    num = num / 1000; // ms -> s
  }
  return new Date(num * 1000);
}

// Date -> epoch seconds
function dateToEpochSeconds(d) {
  if (!d) return null;
  return Math.floor(d.getTime() / 1000);
}

// -------- STRING CONFIG --------
function summarizeStringCfg(list) {
  if (!list || !list.length) return "";
  const parts = [];
  for (const it of list) {
    if (!it) continue;
    const name = (it.name || "").trim();
    let vals = it.value || [];
    if (typeof vals === "string") {
      vals = vals.split(",").map((v) => v.trim()).filter(Boolean);
    } else if (!Array.isArray(vals)) {
      vals = vals != null ? [String(vals)] : [];
    } else {
      vals = vals.map((v) => String(v).trim()).filter(Boolean);
    }
    if (name) {
      parts.push(vals.length ? `${name}: ${vals.join(", ")}` : `${name}:`);
    }
  }
  return parts.join(" | ");
}

function parseStringCfg(str) {
  const out = [];
  if (!str) return out;
  const parts = String(str)
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const p of parts) {
    if (!p.includes(":")) {
      if (p.trim()) out.push({ name: p.trim(), value: [] });
      continue;
    }
    const [rawName, rawVals] = p.split(":", 1);
    const name = rawName.trim();
    const vals = rawVals
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    out.push({ name, value: vals });
  }
  return out;
}

function stringifyStringCfg(list) {
  if (!list || !list.length) return "";
  const items = [];
  for (const it of list) {
    if (!it) continue;
    const n = (it.name || "").trim();
    let vals = it.value || [];
    if (typeof vals === "string") {
      vals = vals.split(",").map((v) => v.trim()).filter(Boolean);
    } else if (!Array.isArray(vals)) {
      vals = vals != null ? [String(vals)] : [];
    } else {
      vals = vals.map((v) => String(v).trim()).filter(Boolean);
    }
    items.push(vals.length ? `${n}: ${vals.join(", ")}` : `${n}:`);
  }
  return items.join(" | ");
}

// -------- NUMBER CONFIG --------
function parseNumberCfg(str) {
  const out = [];
  if (!str) return out;

  const parts = str.split("|").map((p) => p.trim()).filter(Boolean);

  for (const p of parts) {
    if (!p.includes(":")) {
      if (p.trim()) out.push({ name: p.trim(), value: [] });
      continue;
    }
    const [rawName, rawVals] = p.split(":", 1);
    const name = rawName.trim();
    const values = rawVals
      .split(",")
      .map((v) => v.trim())
      .filter((x) => /^-?\d+$/.test(x))
      .map((x) => parseInt(x, 10));

    out.push({ name, value: values });
  }
  return out;
}

function stringifyNumberCfg(list) {
  if (!list?.length) return "";
  return list
    .map((it) => {
      const name = (it.name || "").trim();
      const vals = (it.value || [])
        .filter((v) => /^-?\d+$/.test(String(v).trim()))
        .map((v) => parseInt(v, 10));
      return vals.length ? `${name}: ${vals.join(",")}` : `${name}:`;
    })
    .join(" | ");
}

function normalizeNumberCfg(list) {
  if (!Array.isArray(list)) return [];
  return list.map((i) => ({
    name: (i?.name || "").trim(),
    value: (i?.value || [])
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v)),
  }));
}

// -------- RANGE CONFIG --------
function parseRangeCfg(str) {
  const out = [];
  if (!str) return out;

  const parts = str.split("|").map((p) => p.trim()).filter(Boolean);

  for (const p of parts) {
    if (!p.includes(":") || !p.includes("-")) continue;

    const [rawName, rawRange] = p.split(":");
    const [minS, maxS] = rawRange.split("-");

    if (/^-?\d+$/.test(minS.trim()) && /^-?\d+$/.test(maxS.trim())) {
      out.push({
        name: rawName.trim(),
        min: parseInt(minS, 10),
        max: parseInt(maxS, 10),
      });
    }
  }
  return out;
}

function stringifyRangeCfg(list) {
  if (!list?.length) return "";
  return list
    .map((it) => `${it.name}:${it.min}-${it.max}`)
    .join(" | ");
}

function summarizeRangeCfg(list) {
  return stringifyRangeCfg(list);
}

function normalizeRangeCfg(list) {
  if (!Array.isArray(list)) return [];
  return list.map((i) => ({
    name: (i?.name || "").trim(),
    min: Number.isFinite(Number(i?.min)) ? Number(i.min) : null,
    max: Number.isFinite(Number(i?.max)) ? Number(i.max) : null,
  }));
}

// -------- STRING CFG normalize --------
function normalizeStringCfg(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const name = (item?.name || "").trim();
    let vals = item?.value ?? [];

    if (typeof vals === "string") {
      vals = vals.split(",").map((v) => v.trim()).filter(Boolean);
    } else if (!Array.isArray(vals)) {
      vals = [String(vals)];
    } else {
      vals = vals.map((v) => String(v).trim()).filter(Boolean);
    }
    return { name, value: vals };
  });
}

// ========== COMPONENT ==========
const CampaignJsonEditor = () => {
  const [rawInput, setRawInput] = useState("");
  const [campaign, setCampaign] = useState(null);
  const [missions, setMissions] = useState([]);
  const [exportJson, setExportJson] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const hasUnsavedChanges =
    !!campaign ||
    missions.length > 0 ||
    rawInput.trim() !== "";
    // Cảnh báo khi tắt tab / reload nếu đang có dữ liệu

  const hasUnsavedRef = useRef(false);
  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

    // Cảnh báo khi tắt tab / reload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

    // Cảnh báo khi nhấn nút Back/Forward của trình duyệt
  useEffect(() => {
    // Đẩy 1 state "ảo" vào history để lần bấm Back đầu tiên đi qua đây
    window.history.replaceState({ editorGuard: true }, "", window.location.href);
    window.history.pushState({ editorGuard: true }, "", window.location.href);

    const handlePopState = (event) => {
      // Nếu không phải state của editor hoặc không có dữ liệu thì cho back bình thường
      if (!event.state || !event.state.editorGuard || !hasUnsavedRef.current) {
        return;
      }

      const confirmLeave = window.confirm(
        "                            Out????? Sure?????\n" +
          "Are you sure you want to go back to the previous page??"
      );

      if (!confirmLeave) {
        // Người dùng chọn ở lại → đẩy lại state để “hủy” thao tác Back
        window.history.pushState({ editorGuard: true }, "", window.location.href);
      }
      // Nếu đồng ý rời trang: không làm gì, browser tiếp tục Back bình thường
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);


  // Dates
  const [acceptStartTime, setAcceptStartTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [expireTime, setExpireTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  // top-level inputs
  const [name, setName] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [description, setDescription] = useState("");
  const [termAndConditions, setTermAndConditions] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  const [segmentStr, setSegmentStr] = useState("");
  const [excludeSegmentStr, setExcludeSegmentStr] = useState("");

  const [status, setStatus] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [topReward, setTopReward] = useState(0);
  const [isAllowDirectlyClaim, setIsAllowDirectlyClaim] = useState(false);

  // Dialog states
  const [ncDialogIndex, setNcDialogIndex] = useState(null);
  const [rcDialogIndex, setRcDialogIndex] = useState(null);
  const [scDialogIndex, setScDialogIndex] = useState(null);

  const [ncDialogRows, setNcDialogRows] = useState([]);
  const [rcDialogRows, setRcDialogRows] = useState([]);
  const [scDialogRows, setScDialogRows] = useState([]);

  const fileInputRef = useRef(null);
    // ====== Drag & Drop Missions ======
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragEnter = (index) => {
      if (dragIndex === null || dragIndex === index) return;

      setMissions((prev) => {
        const newList = [...prev];
        const [moved] = newList.splice(dragIndex, 1);
        newList.splice(index, 0, moved);
        return newList;
      });

      // cập nhật lại vị trí đang kéo
      setDragIndex(index);
    };

    const handleDragEnd = () => {
      setDragIndex(null);
    };

  const duplicateMission = (index) => {
    setMissions(prev => {
      const target = prev[index];

      // Tạo bản sao sâu (deep clone)
      const clone = JSON.parse(JSON.stringify(target));

      // Đổi tên mission để tránh trùng
      clone.name = `${clone.name} (Copy)`;

      return [
        ...prev.slice(0, index + 1),
        clone,
        ...prev.slice(index + 1)
      ];
    });
  };

  const handleOpenPreview = () => {
      try {
        const cleanJson = exportJson.trim();
        const encoded = encodeURIComponent(cleanJson);

        // const url = `https://luxury-lolly-56674e.netlify.app/?data=${encoded}`;
        const url = `https://luxury-lolly-56674e.netlify.app/`;

        window.open(url, "_blank");
      } catch (err) {
        alert("Invalid JSON, cannot open preview!");
      }
    };
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      alert("Doneee");
    } catch (err) {
      alert("ERROR!!!");
    }
  };

  // ----- Load file -----
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (typeof evt.target.result === "string") {
        setRawInput(evt.target.result);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  // ----- Load JSON -----
  const handleLoadJson = () => {
    try {
      const obj = JSON.parse(rawInput || "{}");
      setCampaign(obj);

      setAcceptStartTime(epochToDate(obj.accept_start_time));
      setStartTime(epochToDate(obj.start_time));
      setExpireTime(epochToDate(obj.expire_time));
      setEndTime(epochToDate(obj.end_time));

      setName(obj.name || "");
      setPolicyId(obj.policy_id || "");
      setDescription(obj.description || "");
      setTermAndConditions(obj.term_and_conditions || "");
      setBannerUrl(obj.banner_url || "");
      setIconUrl(obj.icon_url || "");

      setStatus(Number(obj.status || 0));
      setQuantity(Number(obj.quantity || 0));

      const ba = obj.bonus_account_reward || {};
      setTopReward(ba.bonus_account_amount || 0);

      setIsAllowDirectlyClaim(Boolean(obj.is_allow_directly_claim));

      setSegmentStr((obj.segment || []).join(", "));
      setExcludeSegmentStr((obj.exclude_segment || []).join(", "));

      const normalized = (obj.missions || []).map((m) => {
        const cfg = m.order_point_cfg || {};
        return {
          name: m.name || "",
          description: m.description || "",
          milestone: Number(m.milestone || 0),
          quantity: Number(m.quantity || 0),
          rewardAmount:
            (m.bonus_account_reward || {}).bonus_account_amount || 0,
          pointType: cfg.point_type || "",
          list_number_cfg: normalizeNumberCfg(cfg.list_number_cfg || []),
          range_cfg: normalizeRangeCfg(cfg.range_cfg || []),
          list_string_cfg: normalizeStringCfg(cfg.list_string_cfg || []),
        };
      });

      setMissions(normalized);
      setExportJson("");

      alert("Doneee");
    } catch (err) {
      alert("Invalid JSON: " + err.message);
    }
  };

  // ----- Change mission fields -----
  const handleMissionFieldChange = (index, field, value) => {
    setMissions((prev) =>
      prev.map((m, i) =>
        i !== index
          ? m
          : {
              ...m,
              [field]:
                ["milestone", "quantity", "rewardAmount"].includes(field)
                  ? Number(value || 0)
                  : value,
            }
      )
    );
  };

  const handleNumberCfgTextChange = (index, text) => {
    const parsed = parseNumberCfg(text);
    setMissions((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              list_number_cfg: parsed.length
                ? parsed
                : [{ name: "", value: [] }],
            }
          : m
      )
    );
  };

  const handleRangeCfgTextChange = (index, text) => {
    const parsed = parseRangeCfg(text);
    setMissions((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              range_cfg: parsed.length
                ? parsed
                : [{ name: "", min: null, max: null }],
            }
          : m
      )
    );
  };

  const handleStringCfgTextChange = (index, text) => {
    const parsed = parseStringCfg(text);
    setMissions((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              list_string_cfg: parsed.length
                ? parsed
                : [{ name: "", value: [] }],
            }
          : m
      )
    );
  };

  // ===== OPEN DIALOGS =====
  const openNcDialog = (i) => {
    const m = missions[i];
    setNcDialogIndex(i);
    setNcDialogRows(
      m.list_number_cfg.length
        ? JSON.parse(JSON.stringify(m.list_number_cfg))
        : [{ name: "", value: [] }]
    );
  };

  const openRcDialog = (i) => {
    const m = missions[i];
    setRcDialogIndex(i);
    setRcDialogRows(
      m.range_cfg.length
        ? JSON.parse(JSON.stringify(m.range_cfg))
        : [{ name: "", min: null, max: null }]
    );
  };

  const openScDialog = (i) => {
    const m = missions[i];
    setScDialogIndex(i);
    setScDialogRows(
      m.list_string_cfg.length
        ? JSON.parse(JSON.stringify(m.list_string_cfg))
        : [{ name: "", value: [] }]
    );
  };

  // ===== SAVE DIALOG =====
  const saveNcDialog = () => {
    setMissions((prev) =>
      prev.map((m, i) =>
        i === ncDialogIndex
          ? {
              ...m,
              list_number_cfg: ncDialogRows.map((r) => ({
                name: (r.name || "").trim(),
                value: (r.value || [])
                  .map((v) => Number(v))
                  .filter((v) => Number.isFinite(v)),
              })),
            }
          : m
      )
    );
    setNcDialogIndex(null);
  };

  const saveRcDialog = () => {
    setMissions((prev) =>
      prev.map((m, i) =>
        i === rcDialogIndex
          ? {
              ...m,
              range_cfg: rcDialogRows
                .filter(
                  (r) =>
                    r.name &&
                    Number.isFinite(Number(r.min)) &&
                    Number.isFinite(Number(r.max))
                )
                .map((r) => ({
                  name: r.name,
                  min: Number(r.min),
                  max: Number(r.max),
                })),
            }
          : m
      )
    );
    setRcDialogIndex(null);
  };

  const saveScDialog = () => {
    setMissions((prev) =>
      prev.map((m, i) =>
        i === scDialogIndex
          ? {
              ...m,
              list_string_cfg: scDialogRows
                .filter((r) => r.name)
                .map((r) => ({
                  name: r.name,
                  value: (r.value || []).map((v) => v.trim()).filter(Boolean),
                })),
            }
          : m
      )
    );
    setScDialogIndex(null);
  };

  const closeDialogs = () => {
    setNcDialogIndex(null);
    setRcDialogIndex(null);
    setScDialogIndex(null);
  };

  // ===== EXPORT JSON =====
  const handleExportJson = () => {
    if (!campaign) return alert("Chưa có dữ liệu!");

    const out = {};

    out.accept_start_time = acceptStartTime
      ? dateToEpochSeconds(acceptStartTime)
      : null;

    out.start_time = startTime ? dateToEpochSeconds(startTime) : null;
    out.expire_time = expireTime ? dateToEpochSeconds(expireTime) : null;
    out.end_time = endTime ? dateToEpochSeconds(endTime) : null;

    out.name = name;
    out.description = description;
    out.term_and_conditions = termAndConditions;
    out.icon_url = iconUrl;
    out.banner_url = bannerUrl;
    out.policy_id = policyId;

    out.segment = segmentStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    out.exclude_segment = excludeSegmentStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    out.is_allow_directly_claim = Boolean(isAllowDirectlyClaim);

    if (Number(status) !== 0) out.status = Number(status);

    if (Number(quantity) !== 0) out.quantity = Number(quantity);

    // ---- Không xuất bonus_account_reward nếu amount = 0 ----
    if (Number(topReward) > 0) {
      
      out.bonus_account_reward = {
        bonus_account_amount: Number(topReward),
        reward_type: "bonus",
      };
    }

    out.missions = missions.map((m) => {
      const orderCfg = {
        point_type: m.pointType || "",
      };

      if (m.list_number_cfg?.length) orderCfg.list_number_cfg = m.list_number_cfg;
      if (m.range_cfg?.length) orderCfg.range_cfg = m.range_cfg;
      if (m.list_string_cfg?.length)
        orderCfg.list_string_cfg = m.list_string_cfg;

      return {
        name: m.name,
        description: m.description,
        milestone: Number(m.milestone || 0),
        quantity: Number(m.quantity || 0),
        bonus_account_reward: {
          bonus_account_amount: Number(m.rewardAmount || 0),
          reward_type: "bonus",
        },
        order_point_cfg: orderCfg,
      };
    });

    setExportJson(JSON.stringify(out, null, 2));
  };

      const handleDownload = () => {
        const fileName = prompt("Enter JSON file name:", "")?.trim();
        if (!fileName) return;

        const blob = new Blob([exportJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = fileName.endsWith(".json") ? fileName : `${fileName}.json`;

        // Fix Chrome (cần để click hoạt động )
        document.body.appendChild(a);
        setTimeout(() => {
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
      };

  // ===== DATE PICKER =====
  const dateToLocalInput = (d) => {
    if (!d) return "";
    const pad = (x) => String(x).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  };

  const localInputToDate = (v) => (v ? new Date(v) : null);

  // ===== ADD / DELETE MISSION =====
  const addMission = () => {
    const newMission = {
      name: "",
      description: "",
      milestone: 0,
      quantity: 0,
      rewardAmount: 0,
      pointType: "",
      list_number_cfg: [],
      range_cfg: [],
      list_string_cfg: [],
    };
    setMissions((prev) => [...prev, newMission]);
  };

  const deleteMission = (index) => {
    if (!window.confirm("Are you sure you want to delete this mission?")) return;
    setMissions((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== RENDER =====
  return (
    <div className="editor-container">
      <h1>HotPromo JSON Editor</h1>

      {/* Input JSON */}
      <section className="section">
        <h3>Enter JSON</h3>

        <div className="grid-2">
          <div>
            <label>Paste JSON</label>
            <textarea
              className="field"
              rows={10}
              placeholder='{"name": "...", "missions": [...]}'
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          <div>
            <label>Upload file JSON  </label>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <button onClick={handleLoadJson} className="btn">
          Load JSON
        </button>
      </section>

      {!campaign && <div className="empty-hint">Paste or upload JSON to get started (if available) </div>}

      {campaign && (
        <>
          {/* Banner */}
          <h2>Banner & Icon</h2>
          <section className="section">
            <div className="banner-icon-grid">
              <div>
                <label>Banner URL</label>
                <input
                  type="text"
                  className="field"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://..."
                />

                {bannerUrl && (
                  <div className="img-preview">
                    <img src={bannerUrl} alt="Banner Preview" />
                  </div>
                )}
              </div>

              <div>
                <label>Icon URL</label>
                <input
                  type="text"
                  className="field"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="https://..."
                />

                {iconUrl && (
                  <div className="img-preview small">
                    <img src={iconUrl} alt="Icon Preview" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ==== BASIC INFO ==== */}
          <h2>HotPromo Information</h2>
          <section className="section">

            {/* ==== ROW 1: TIME SETTINGS (2 hàng × 2 cột) ==== */}
            <div className="time-grid">
              <div>
                <label>Accept Start Time</label>
                <input
                  className="field"
                  type="datetime-local"
                  value={dateToLocalInput(acceptStartTime)}
                  onChange={(e) => setAcceptStartTime(localInputToDate(e.target.value))}
                />
              </div>

              <div>
                <label>Start Time</label>
                <input
                  className="field"
                  type="datetime-local"
                  value={dateToLocalInput(startTime)}
                  onChange={(e) => setStartTime(localInputToDate(e.target.value))}
                />
              </div>

              <div>
                <label>Expire Time</label>
                <input
                  className="field"
                  type="datetime-local"
                  value={dateToLocalInput(expireTime)}
                  onChange={(e) => setExpireTime(localInputToDate(e.target.value))}
                />
              </div>

              <div>
                <label>End Time</label>
                <input
                  className="field"
                  type="datetime-local"
                  value={dateToLocalInput(endTime)}
                  onChange={(e) => setEndTime(localInputToDate(e.target.value))}
                />
              </div>
            </div>

            {/* ==== ROW 2: CAMPAIGN NAME + POLICY ID ==== */}
            <div className="grid-2" style={{ marginTop: "24px" }}>
              <div>
                <label>Campaign Name</label>
                <input
                  className="field"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label>Policy ID</label>
                <input
                  className="field"
                  type="text"
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                />
              </div>
            </div>

            {/* ==== ROW 3: DESCRIPTION FULL WIDTH ==== */}
            <div className="full-row" style={{ marginTop: "20px" }}>
              <label>Description</label>
              <textarea
                className="field"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* ==== ROW 4: QUANTITY – STATUS – BONUS ==== */}
            <div className="grid-3" style={{ marginTop: "24px" }}>
              <div>
                <label>Quantity</label>
                <input
                  className="field"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>

              <div>
                <label>Status</label>
                <input
                  className="field"
                  type="number"
                  value={status}
                  onChange={(e) => setStatus(Number(e.target.value))}
                />
              </div>

              <div>
                <label>Bonus Amount</label>
                <input
                  className="field"
                  type="number"
                  value={topReward}
                  onChange={(e) => setTopReward(Number(e.target.value))}
                />
              </div>
            </div>

            {/* ==== CHECKBOX ==== */}
            <div style={{ marginTop: "12px" }}>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={isAllowDirectlyClaim}
                  onChange={(e) => setIsAllowDirectlyClaim(e.target.checked)}
                />
                &nbsp; Enable direct claim
              </label>
            </div>

            {/* ==== TERMS & CONDITIONS ==== */}
            <div className="full-row" style={{ marginTop: "28px" }}>
              <label>Terms & Conditions</label>
              <ReactQuill
                theme="snow"
                value={termAndConditions}
                onChange={setTermAndConditions}
                style={{ height: "300px", marginBottom: "40px" }}
              />
            </div>

          </section>

          {/* SEGMENTS */}
          <h2>Segments</h2>
          <section className="section">
            <div className="grid-2">
              <div>
                <label>Include (separated by ,)</label>
                <textarea
                  className="field"
                  rows={3}
                  value={segmentStr}
                  onChange={(e) => setSegmentStr(e.target.value)}
                />
              </div>

              <div>
                <label>Exclude (separated by ,)</label>
                <textarea
                  className="field"
                  rows={3}
                  value={excludeSegmentStr}
                  onChange={(e) => setExcludeSegmentStr(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* MISSIONS */}
          <h2>Missions</h2>

          <button className="add-btn" onClick={addMission}>
            ➕ Add Mission
          </button>

          <section className="section">
            <div className="table-container">
              <table className="mission-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>↕</th>
                    <th>Mission Name</th>
                    <th>Description</th>
                    <th>Milestone</th>
                    <th>Quantity</th>
                    <th>Reward</th>
                    <th>Point Type</th>
                    <th>NumberCfg</th>
                    <th>RangeCfg</th>
                    <th>StringCfg</th>
                    <th>Edit Config</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {missions.map((m, i) => (
                    <tr
                      key={i}
                      className={i === dragIndex ? "dragging-row" : ""}
                    >
                      {/* Drag handle */}
                      <td
                        className="drag-cell"
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragEnter={() => handleDragEnter(i)}
                        onDragOver={(e) => e.preventDefault()} // cần để onDragEnter hoạt động
                        onDragEnd={handleDragEnd}
                      >
                        <span className="drag-handle">↕</span>
                      </td>

                      {/* Mission Name */}
                      <td>
                        <input
                          className="field"
                          value={m.name}
                          onChange={(e) =>
                            handleMissionFieldChange(i, "name", e.target.value)
                          }
                        />
                      </td>

                      {/* Description */}
                      <td>
                        <textarea
                          className="field"
                          rows={2}
                          value={m.description}
                          onChange={(e) =>
                            handleMissionFieldChange(
                              i,
                              "description",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      {/* Milestone */}
                      <td>
                        <input
                          className="field small"
                          type="number"
                          value={m.milestone}
                          onChange={(e) =>
                            handleMissionFieldChange(
                              i,
                              "milestone",
                              Number(e.target.value)
                            )
                          }
                        />
                      </td>

                      {/* Quantity */}
                      <td>
                        <input
                          className="field small"
                          type="number"
                          value={m.quantity}
                          onChange={(e) =>
                            handleMissionFieldChange(
                              i,
                              "quantity",
                              Number(e.target.value)
                            )
                          }
                        />
                      </td>

                      {/* Reward */}
                      <td>
                        <input
                          className="field small"
                          type="number"
                          value={m.rewardAmount}
                          onChange={(e) =>
                            handleMissionFieldChange(
                              i,
                              "rewardAmount",
                              Number(e.target.value)
                            )
                          }
                        />
                      </td>

                      {/* Point Type */}
                      <td>
                        <select
                          className="field"
                          value={m.pointType}
                          onChange={(e) =>
                            handleMissionFieldChange(
                              i,
                              "pointType",
                              e.target.value
                            )
                          }
                        >
                          <option value="">--choose--</option>
                          {POINT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>

                      {/* Number Cfg */}
                      <td>
                        <textarea
                          className="field"
                          rows={2}
                          value={stringifyNumberCfg(m.list_number_cfg)}
                          onChange={(e) =>
                            handleNumberCfgTextChange(i, e.target.value)
                          }
                        />
                      </td>

                      {/* Range Cfg */}
                      <td>
                        <textarea
                          className="field"
                          rows={2}
                          value={summarizeRangeCfg(m.range_cfg)}
                          onChange={(e) =>
                            handleRangeCfgTextChange(i, e.target.value)
                          }
                        />
                      </td>

                      {/* String Cfg */}
                      <td>
                        <textarea
                          className="field"
                          rows={2}
                          value={summarizeStringCfg(m.list_string_cfg)}
                          onChange={(e) =>
                            handleStringCfgTextChange(i, e.target.value)
                          }
                        />
                      </td>

                      {/* Edit Cfg */}
                      <td>
                        <div className="action-grid edit-config">
                          <button className="act-btn" onClick={() => openNcDialog(i)}>Edit Number</button>
                          <button className="act-btn" onClick={() => openRcDialog(i)}>Edit Range</button>
                          <button className="act-btn" onClick={() => openScDialog(i)}>Edit String</button>


                        </div>
                      </td>
                      {/* Actions */}
                      <td>
                        <div className="action-grid edit-config">
                          <button className="act-btn delete" onClick={() => deleteMission(i)}>❌ Delete</button>
                          <button className="btn-duplicate" onClick={() => duplicateMission(i)}>Duplicate</button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {/* EXPORT */}
          <button className="btn-export" onClick={handleExportJson}>
            ⬇️ Export JSON
          </button>

          {/* SIMPLE VIEW LIKE EXCEL */}
          {missions.length > 0 && (
            <div className="mission-overview">
              <div className="mission-overview-title">
                Mission overview (view only)
              </div>

              <div className="mission-overview-table-wrapper">
                <table className="mission-overview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mission Name</th>
                      <th>Description</th>
                      <th>Milestone</th>
                      <th>Quantity</th>
                      <th>Reward</th>
                      <th>Point Type</th>
                      <th>NumberCfg</th>
                      <th>RangeCfg</th>
                      <th>StringCfg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.map((m, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{m.name}</td>
                        <td>{m.description}</td>
                        <td>{m.milestone}</td>
                        <td>{m.quantity}</td>
                        <td>{m.rewardAmount}</td>
                        <td>{m.pointType}</td>
                        <td>{stringifyNumberCfg(m.list_number_cfg)}</td>
                        <td>{summarizeRangeCfg(m.range_cfg)}</td>
                        <td>{summarizeStringCfg(m.list_string_cfg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {exportJson && (
            <div className="export-area">
              <pre className="export-box">{exportJson}</pre>
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                  <button className="btn" onClick={handleDownload}>
                    Download edited JSON
                  </button>
                {/* Copy JSON */}
                <button
                  className="btn"
                  style={{ background: "#1976d2" }}
                  onClick={handleCopyJson}
                >
                  📋 Copy JSON
                </button>
                <button
                  className="btn"
                  style={{ background: "#ff6d00" }}
                  onClick={handleOpenPreview}
                >
                  👁 Preview UI
                </button>
                </div>

            </div>
            
          )}
        </>
      )}


      {/* DIALOG OVERLAY */}
      {(ncDialogIndex !== null ||
        rcDialogIndex !== null ||
        scDialogIndex !== null) && (
        <div className="dialog-overlay" onClick={closeDialogs}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            {/* NUMBER DIALOG */}
            {ncDialogIndex !== null && (
              <>
                <h3>Edit Number Config</h3>

                {ncDialogRows.map((row, idx) => (
                  <div key={idx} className="dialog-row-3">
                    <select
                      value={row.name}
                      onChange={(e) =>
                        setNcDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, name: e.target.value } : r
                          )
                        )
                      }
                    >
                      <option value="">--Type--</option>
                      {NUMBER_CFG_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={(row.value || []).join(",")}
                      onChange={(e) => {
                        const vals = e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean);
                        setNcDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, value: vals } : r
                          )
                        );
                      }}
                    />

                    <button
                      className="del-btn"
                      onClick={() =>
                        setNcDialogRows((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setNcDialogRows((p) => [...p, { name: "", value: [] }])
                  }
                >
                  + Thêm config
                </button>

                <div className="dialog-actions">
                  <button onClick={saveNcDialog}>💾 Save</button>
                  <button onClick={closeDialogs}>Close</button>
                </div>
              </>
            )}

            {/* RANGE DIALOG */}
            {rcDialogIndex !== null && (
              <>
                <h3>Edit Range Config</h3>

                {rcDialogRows.map((row, idx) => (
                  <div key={idx} className="dialog-row-4">
                    <select
                      value={row.name}
                      onChange={(e) =>
                        setRcDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, name: e.target.value } : r
                          )
                        )
                      }
                    >
                      <option value="">--Type--</option>
                      {RANGE_CFG_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Min"
                      value={row.min ?? ""}
                      onChange={(e) =>
                        setRcDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  min: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : r
                          )
                        )
                      }
                    />

                    <input
                      type="text"
                      placeholder="Max"
                      value={row.max ?? ""}
                      onChange={(e) =>
                        setRcDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  max: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : r
                          )
                        )
                      }
                    />

                    <button
                      className="del-btn"
                      onClick={() =>
                        setRcDialogRows((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setRcDialogRows((p) => [
                      ...p,
                      { name: "", min: null, max: null },
                    ])
                  }
                >
                  + Thêm config
                </button>

                <div className="dialog-actions">
                  <button onClick={saveRcDialog}>💾 Save</button>
                  <button onClick={closeDialogs}>Close</button>
                </div>
              </>
            )}

            {/* STRING DIALOG */}
            {scDialogIndex !== null && (
              <>
                <h3>Edit String Config</h3>

                {scDialogRows.map((row, idx) => (
                  <div key={idx} className="dialog-row-3">
                    <select
                      value={row.name}
                      onChange={(e) =>
                        setScDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, name: e.target.value } : r
                          )
                        )
                      }
                    >
                      <option value="">--Type--</option>
                      {STRING_CFG_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={(row.value || []).join(",")}
                      onChange={(e) => {
                        const vals = e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean);
                        setScDialogRows((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, value: vals } : r
                          )
                        );
                      }}
                    />

                    <button
                      className="del-btn"
                      onClick={() =>
                        setScDialogRows((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setScDialogRows((p) => [...p, { name: "", value: [] }])
                  }
                >
                  + Thêm config
                </button>

                <div className="dialog-actions">
                  <button onClick={saveScDialog}>💾 Save</button>
                  <button onClick={closeDialogs}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignJsonEditor;
