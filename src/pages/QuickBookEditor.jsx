import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Type, Maximize, Bold, Save, ChevronLeft, ChevronRight, Plus, BookOpen, Palette, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient'; 

// --- HELPER COMPONENT: FREE-FORM POLYGON MASK ---
const DraggableMask = ({ mask, updateMask, removeMask, isActive, setActiveMask }) => {
  const [draggedPoint, setDraggedPoint] = useState(null);
  const [isDraggingAll, setIsDraggingAll] = useState(false);
  const actionRef = useRef({ startX: 0, startY: 0, initialPoints: [] });

  // Default to a 4-point polygon if loading an older mask
  const pts = mask.points || [
    {x: mask.x || 100, y: mask.y || 100},
    {x: (mask.x || 100) + (mask.w || 250), y: mask.y || 100},
    {x: (mask.x || 100) + (mask.w || 250), y: (mask.y || 100) + (mask.h || 80)},
    {x: mask.x || 100, y: (mask.y || 100) + (mask.h || 80)}
  ];

  const startDragAll = (e) => {
    e.stopPropagation();
    setActiveMask(mask.id);
    setIsDraggingAll(true);
    actionRef.current = { startX: e.clientX, startY: e.clientY, initialPoints: pts };
  };

  const startDragPoint = (e, index) => {
    e.stopPropagation();
    setActiveMask(mask.id);
    setDraggedPoint(index);
    actionRef.current = { startX: e.clientX, startY: e.clientY, initialPoints: pts };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      const dx = e.clientX - actionRef.current.startX;
      const dy = e.clientY - actionRef.current.startY;

      if (isDraggingAll) {
        const newPoints = actionRef.current.initialPoints.map(p => ({
          x: Math.max(0, Math.min(600, p.x + dx)),
          y: Math.max(0, Math.min(400, p.y + dy))
        }));
        updateMask(mask.id, { points: newPoints });
      } else if (draggedPoint !== null) {
        const newPoints = [...actionRef.current.initialPoints];
        newPoints[draggedPoint] = {
          x: Math.max(0, Math.min(600, newPoints[draggedPoint].x + dx)),
          y: Math.max(0, Math.min(400, newPoints[draggedPoint].y + dy))
        };
        updateMask(mask.id, { points: newPoints });
      }
    };
    const onMouseUp = () => { setIsDraggingAll(false); setDraggedPoint(null); };

    if (isDraggingAll || draggedPoint !== null) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDraggingAll, draggedPoint, mask.id, updateMask]);

  const minX = Math.min(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); setActiveMask(mask.id); }}
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: isActive ? 50 : 15
      }}
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <polygon 
          points={pts.map(p => `${p.x},${p.y}`).join(' ')} 
          fill={isActive ? 'rgba(231, 76, 60, 0.25)' : 'rgba(231, 76, 60, 0.1)'}
          stroke={isActive ? '#e74c3c' : 'rgba(231, 76, 60, 0.6)'}
          strokeWidth="2"
          strokeDasharray={isActive ? "none" : "5,5"}
          pointerEvents="auto"
          onMouseDown={startDragAll}
          style={{ cursor: isActive ? 'move' : 'pointer' }}
        />
      </svg>

      {isActive && (
        <div style={{ position: 'absolute', top: Math.max(0, minY - 30), left: minX, pointerEvents: 'auto' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); removeMask(mask.id); }} 
            style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
          >Delete</button>
        </div>
      )}
      
      {/* FREE-FORM CORNER HANDLES */}
      {isActive && pts.map((p, i) => (
        <div 
          key={i}
          onMouseDown={(e) => startDragPoint(e, i)}
          style={{
            position: 'absolute', left: p.x - 6, top: p.y - 6,
            width: '12px', height: '12px', backgroundColor: '#e74c3c',
            borderRadius: '50%', cursor: 'crosshair', pointerEvents: 'auto',
            border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
        />
      ))}
    </div>
  );
};

// --- HELPER COMPONENT: DRAGGABLE TEXT BOX ---
const DraggableBox = ({ box, updateBox, removeBox, isActive, setActiveBox, setActiveSelection }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const actionRef = useRef({ startX: 0, startY: 0, initialX: box.x, initialY: box.y, initialW: box.w });
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [box.text, box.w, box.fontSizePx, box.fontFamily, box.fontWeight, box.wordSpacingPx, isEditing]);

  useEffect(() => {
    if (!isActive) setIsEditing(false);
  }, [isActive]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const startDrag = (e) => {
    e.stopPropagation();
    setActiveBox(box.id);
    if (!isEditing) {
      setIsDragging(true);
      actionRef.current = { startX: e.clientX, startY: e.clientY, initialX: box.x, initialY: box.y };
    }
  };

  const startResize = (e) => {
    e.stopPropagation();
    setActiveBox(box.id);
    setIsResizing(true);
    actionRef.current = { startX: e.clientX, initialW: box.w };
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSelectionChange = (e) => {
    setActiveSelection({ start: e.target.selectionStart, end: e.target.selectionEnd, boxId: box.id });
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - actionRef.current.startX;
        const dy = e.clientY - actionRef.current.startY;
        updateBox(box.id, {
          x: Math.max(0, Math.min(600 - box.w, actionRef.current.initialX + dx)),
          y: Math.max(0, Math.min(400 - 30, actionRef.current.initialY + dy)),
        });
      } else if (isResizing) {
        const dx = e.clientX - actionRef.current.startX;
        updateBox(box.id, { w: Math.max(50, Math.min(600 - box.x, actionRef.current.initialW + dx)) });
      }
    };
    const onMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, isResizing, box.id, box.w, box.x, updateBox]);

  const commonStyles = {
    width: '100%',
    fontFamily: `'${box.fontFamily}', sans-serif`,
    fontSize: `${box.fontSizePx}px`,
    fontWeight: box.fontWeight,
    wordSpacing: `${box.wordSpacingPx || 0}px`,
    lineHeight: '1.4',
    padding: '2px',
    boxSizing: 'border-box',
  };

  const renderColoredText = () => {
    if (!box.text) return null;
    const wordRegex = /\S+|\s+/g;
    let wordCount = 0;
    const chunks = box.text.match(wordRegex) || [];

    return chunks.map((chunk, i) => {
      if (/\S/.test(chunk)) {
        const color = (box.wordColors && box.wordColors[wordCount]) ? box.wordColors[wordCount] : (box.color || '#000000');
        wordCount++;
        return <span key={i} style={{ color }}>{chunk}</span>;
      } else {
        return <span key={i}>{chunk}</span>;
      }
    });
  };

  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); setActiveBox(box.id); }}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.w,
        border: isActive ? (isEditing ? '1px solid #26B8F5' : '1px dashed #26B8F5') : '1px solid transparent',
        backgroundColor: isActive ? (isEditing ? 'white' : 'rgba(255, 255, 255, 0.4)') : 'transparent',
        zIndex: isActive ? 49 : 10, boxSizing: 'border-box'
      }}
    >
      {isActive && !isEditing && (
        <button 
          onClick={(e) => { e.stopPropagation(); removeBox(box.id); }} 
          style={{ position: 'absolute', top: '-26px', right: '-1px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
        >Delete</button>
      )}
      
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div
          onMouseDown={!isEditing ? startDrag : undefined}
          onDoubleClick={!isEditing ? handleDoubleClick : undefined}
          style={{
            ...commonStyles,
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            cursor: isEditing ? 'text' : 'move',
            opacity: isEditing ? 0 : 1,
            pointerEvents: isEditing ? 'none' : 'auto',
            zIndex: 1
          }}
        >
          {renderColoredText()}
        </div>

        <textarea
          ref={textareaRef} 
          value={box.text} 
          onChange={(e) => updateBox(box.id, { text: e.target.value })}
          onBlur={() => setIsEditing(false)} 
          onSelect={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          style={{
            ...commonStyles,
            position: 'relative',
            background: 'transparent', border: 'none', outline: 'none', resize: 'none', 
            color: box.color || '#000000', overflow: 'hidden', 
            opacity: isEditing ? 1 : 0,
            pointerEvents: isEditing ? 'auto' : 'none',
            zIndex: 2
          }}
        />

        {isActive && !isEditing && (
          <div onMouseDown={startResize} style={{ position: 'absolute', top: 0, bottom: 0, right: '-5px', width: '10px', cursor: 'ew-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '4px', height: '16px', backgroundColor: '#26B8F5', borderRadius: '4px' }} />
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN CREATOR STUDIO COMPONENT ---
import { useParams, useNavigate } from 'react-router-dom';

export default function QuickBookEditor() {
  const { id: quickbookId } = useParams();
  const navigate = useNavigate();

  const defaultMetaJson = `{
  "title": "",
  "description": "",
  "subject": "Science",
  "applicable_ages": [5, 6, 7],
  "is_starter_pack": false, 
  "format_type": "trivia", 
  "vibe": "calming",
  "difficulty": "easy",
  "page_count": 10,
  "topic_tags": ["fun_facts", "space"] 
}`;
  const [metaJson, setMetaJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailObj, setThumbnailObj] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  const [pages, setPages] = useState([{ id: 'page-0', bgImage: null, fileObj: null, audioUrl: null, audioFileObj: null, boxes: [], masks: [], assemblyJsonStr: '' }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [activeMaskId, setActiveMaskId] = useState(null);
  const [activeSelection, setActiveSelection] = useState({ start: 0, end: 0, boxId: null });
  const [highlightColor, setHighlightColor] = useState('#e74c3c');

  const currentPage = pages[currentPageIndex] || pages[0];
  const activeBox = currentPage?.boxes.find(b => b.id === activeBoxId);
  const activeMask = (currentPage?.masks || []).find(m => m.id === activeMaskId);

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    if (!quickbookId) return;

    async function loadQuickbook() {
      try {
        const { data: qb, error: qbError } = await supabase
          .from('quickbooks')
          .select('*')
          .eq('id', quickbookId)
          .single();

        if (qbError) throw qbError;

        if (qb) {
          const loadedMeta = {
            title: qb.title || "",
            description: qb.description || "",
            subject: qb.subject || "Science",
            applicable_ages: qb.applicable_ages || [5, 6, 7],
            is_starter_pack: qb.is_starter_pack || false,
            format_type: qb.format_type || "trivia",
            vibe: qb.vibe || "calming",
            difficulty: qb.difficulty || "easy",
            page_count: qb.page_count || 10,
            topic_tags: qb.topic_tags || ["fun_facts", "space"]
          };
          setMetaJson(JSON.stringify(loadedMeta, null, 2));
          if (qb.thumbnail_url) {
            setThumbnailUrl(qb.thumbnail_url);
          }
        }

        const { data: pgData, error: pgError } = await supabase
          .from('quickbook_pages')
          .select('*')
          .eq('quickbook_id', quickbookId)
          .order('page_index', { ascending: true });
        if (pgError) throw pgError;

        if (pgData && pgData.length > 0) {
          const loadedPages = pgData.map(pg => {
            let boxes = [];
            let masks = [];

            const processSide = (sideItems, isLeft) => {
              if (!Array.isArray(sideItems)) return;
              sideItems.forEach(item => {
                if (item.isMask) {
                  const minX = (parseFloat(item.left || 0) / 100) * 300 + (isLeft ? 0 : 300);
                  const minY = (parseFloat(item.top || 0) / 100) * 400;
                  const w = (parseFloat(item.width || 0) / 100) * 300;
                  const h = (parseFloat(item.height || 0) / 100) * 400;
                  
                  let points = [];
                  if (item.clipPath) {
                    const match = item.clipPath.match(/polygon\((.*?)\)/);
                    if (match && match[1]) {
                      const pts = match[1].split(',').map(s => s.trim());
                      points = pts.map(pt => {
                        const parts = pt.split(' ');
                        const xPct = parseFloat(parts[0]);
                        const yPct = parseFloat(parts[1]);
                        return {
                          x: minX + (xPct / 100) * w,
                          y: minY + (yPct / 100) * h
                        };
                      });
                    }
                  }
                  if (points.length !== 4) {
                    points = [
                      {x: minX, y: minY}, {x: minX+w, y: minY},
                      {x: minX+w, y: minY+h}, {x: minX, y: minY+h}
                    ];
                  }
                  masks.push({ id: `mask-${Math.random()}`, x: minX, y: minY, w, h, points });
                } else {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(item.text || "", 'text/html');
                  let rawText = "";
                  let wordColors = {};
                  let wordCount = 0;

                  Array.from(doc.body.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                      const txt = node.textContent;
                      rawText += txt;
                      const words = txt.match(/\S+/g);
                      if (words) wordCount += words.length;
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                      if (node.tagName === 'BR') {
                        rawText += "\n";
                      } else if (node.tagName === 'SPAN') {
                        const txt = node.textContent;
                        const color = node.style.color;
                        const words = txt.match(/\S+/g);
                        if (words) {
                          words.forEach(() => {
                            wordColors[wordCount] = color;
                            wordCount++;
                          });
                        }
                        rawText += txt;
                      }
                    }
                  });

                  const y = (parseFloat(item.top || 0) / 100) * 400;
                  const w = (parseFloat(item.width || 0) / 100) * 300;
                  const x = (parseFloat(item.left || 0) / 100) * 300 + (isLeft ? 0 : 300);
                  const fontSizePx = (parseFloat(item.fontSize || 0) / 100) * 600 || 24;
                  const wordSpacingPx = (parseFloat(item.wordSpacing || 0) / 100) * 600 || 0;

                  boxes.push({
                    id: `box-${Math.random()}`,
                    text: rawText,
                    wordColors: wordColors,
                    x, y, w,
                    fontSizePx,
                    fontWeight: item.fontWeight || 'normal',
                    fontFamily: item.fontFamily || 'Arial',
                    color: item.color || '#000000',
                    wordSpacingPx
                  });
                }
              });
            };

            processSide(pg.left_text, true);
            processSide(pg.right_text, false);

            return {
              dbId: pg.id,
              id: `page-${pg.page_index}`,
              bgImage: pg.image_url,
              fileObj: null,
              audioUrl: pg.audio_url,
              audioFileObj: null,
              boxes: boxes, 
              masks: masks, 
              assemblyJsonStr: JSON.stringify({
                timingArray: pg.audio_timings || []
              }, null, 2)
            };
          });
          setPages(loadedPages);
        }
      } catch (err) {
        console.error("Error loading quickbook", err);
      }
    }

    loadQuickbook();
  }, [quickbookId]);

  useEffect(() => {
    return () => pagesRef.current.forEach(p => { 
      if (p.bgImage) URL.revokeObjectURL(p.bgImage); 
      if (p.audioUrl) URL.revokeObjectURL(p.audioUrl);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [thumbnailUrl]);

  const updateCurrentPage = useCallback((updates) => {
    setPages(prev => prev.map((p, i) => i === currentPageIndex ? { ...p, ...updates } : p));
  }, [currentPageIndex]);

  const goToNextPage = () => {
    if (currentPageIndex === pages.length - 1) {
      setPages(prev => [...prev, { id: `page-${Date.now()}`, bgImage: null, fileObj: null, audioUrl: null, audioFileObj: null, boxes: [], masks: [], assemblyJsonStr: '' }]);
    }
    setCurrentPageIndex(prev => prev + 1);
    setActiveBoxId(null);
    setActiveMaskId(null);
    setActiveSelection({ start: 0, end: 0, boxId: null });
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      setActiveBoxId(null);
      setActiveMaskId(null);
      setActiveSelection({ start: 0, end: 0, boxId: null });
    }
  };

  const removeSpread = () => {
    if (pages.length <= 1) {
      alert("Cannot remove the only spread.");
      return;
    }
    const confirmDelete = window.confirm("Are you sure you want to remove this spread?");
    if (!confirmDelete) return;

    setPages(prev => prev.filter((_, index) => index !== currentPageIndex));
    setCurrentPageIndex(prev => (prev >= pages.length - 1 ? Math.max(0, prev - 1) : prev));
    setActiveBoxId(null);
    setActiveMaskId(null);
    setActiveSelection({ start: 0, end: 0, boxId: null });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (currentPage.bgImage) URL.revokeObjectURL(currentPage.bgImage);
      const objectUrl = URL.createObjectURL(file);
      updateCurrentPage({ bgImage: objectUrl, fileObj: file });
    }
  };

  const addBox = () => {
    const newId = Date.now().toString();
    const newBox = { id: newId, text: "New text block", x: 50, y: 50, w: 200, fontSizePx: 16, fontWeight: "600", fontFamily: "Nunito", color: "#000000", wordSpacingPx: 4, wordColors: {} };
    updateCurrentPage({ boxes: [...currentPage.boxes, newBox] });
    setActiveBoxId(newId);
    setActiveMaskId(null);
  };

  const addMask = () => {
    const newId = 'mask-' + Date.now().toString();
    const newMask = { 
      id: newId, 
      points: [
        {x: 80, y: 50},
        {x: 280, y: 50},
        {x: 280, y: 130},
        {x: 80, y: 130}
      ]
    }; 
    updateCurrentPage({ masks: [...(currentPage.masks || []), newMask] });
    setActiveMaskId(newId);
    setActiveBoxId(null);
  };

  const updateBox = useCallback((id, updates) => {
    updateCurrentPage({ boxes: currentPage.boxes.map(b => b.id === id ? { ...b, ...updates } : b) });
  }, [currentPage, updateCurrentPage]);

  const updateMask = useCallback((id, updates) => {
    updateCurrentPage({ masks: (currentPage.masks || []).map(m => m.id === id ? { ...m, ...updates } : m) });
  }, [currentPage, updateCurrentPage]);

  const removeBox = useCallback((id) => {
    updateCurrentPage({ boxes: currentPage.boxes.filter(b => b.id !== id) });
    setActiveBoxId(prev => (prev === id ? null : prev));
  }, [currentPage, updateCurrentPage]);

  const removeMask = useCallback((id) => {
    updateCurrentPage({ masks: (currentPage.masks || []).filter(m => m.id !== id) });
    setActiveMaskId(prev => (prev === id ? null : prev));
  }, [currentPage, updateCurrentPage]);

  const duplicateBox = useCallback((id) => {
    const sourceBox = currentPage.boxes.find(b => b.id === id);
    if (!sourceBox) return;
    const newId = Date.now().toString();
    const newBox = { ...sourceBox, id: newId, x: Math.min(sourceBox.x + 20, 600 - sourceBox.w), y: Math.min(sourceBox.y + 20, 400 - 30) };
    updateCurrentPage({ boxes: [...currentPage.boxes, newBox] });
    setActiveBoxId(newId);
    setActiveMaskId(null);
  }, [currentPage, updateCurrentPage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (activeBoxId) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBox(activeBoxId); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateBox(activeBoxId); }
      }
      if (activeMaskId) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeMask(activeMaskId); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBoxId, activeMaskId, removeBox, removeMask, duplicateBox]);

  const applyHighlight = () => {
    if (!activeBoxId || activeSelection.boxId !== activeBoxId) return;
    const box = currentPage.boxes.find(b => b.id === activeBoxId);
    if (!box) return;

    const { start, end } = activeSelection;
    if (start === end) {
      alert("Please highlight/select some words in the text box first.");
      return;
    }

    const newWordColors = { ...(box.wordColors || {}) };
    const wordRegex = /\S+/g;
    let match;
    let wordCount = 0;

    while ((match = wordRegex.exec(box.text)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (start < wordEnd && end > wordStart) {
        newWordColors[wordCount] = highlightColor;
      }
      wordCount++;
    }
    updateBox(activeBoxId, { wordColors: newWordColors });
  };

  const clearHighlight = () => {
    if (!activeBoxId || activeSelection.boxId !== activeBoxId) return;
    const box = currentPage.boxes.find(b => b.id === activeBoxId);
    if (!box) return;

    const { start, end } = activeSelection;
    if (start === end) return;

    const newWordColors = { ...(box.wordColors || {}) };
    const wordRegex = /\S+/g;
    let match;
    let wordCount = 0;

    while ((match = wordRegex.exec(box.text)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (start < wordEnd && end > wordStart) {
        delete newWordColors[wordCount];
      }
      wordCount++;
    }
    updateBox(activeBoxId, { wordColors: newWordColors });
  };

  // --- DB EXTRACTOR ---
  const extractPageData = useCallback((pageData, spreadIndex) => {
    const leftBoxes = [];
    const rightBoxes = [];
    const leftMasksArr = [];
    const rightMasksArr = [];
    const formatVal = (val) => parseFloat(val.toFixed(2));

    [...pageData.boxes]
      .sort((a, b) => a.y - b.y)
      .forEach(box => {
        if ((box.x + box.w / 2) < 300) leftBoxes.push(box);
        else rightBoxes.push(box);
      });

    [...(pageData.masks || [])].forEach(mask => {
        const pts = mask.points || [
          {x: mask.x, y: mask.y}, {x: mask.x + mask.w, y: mask.y},
          {x: mask.x + mask.w, y: mask.y + mask.h}, {x: mask.x, y: mask.y + mask.h}
        ];
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const w = maxX - minX;

        if ((minX + w / 2) < 300) leftMasksArr.push({ ...mask, points: pts });
        else rightMasksArr.push({ ...mask, points: pts });
    });

    const formatTextWithColors = (box) => {
      const text = box.text || "";
      const wordColors = box.wordColors || {};
      const wordRegex = /\S+|\s+/g;
      let wordCount = 0;
      const chunks = text.match(wordRegex) || [];

      let resultHtml = "";
      chunks.forEach(chunk => {
        if (/\S/.test(chunk)) {
          if (wordColors[wordCount]) {
             resultHtml += `<span style="color:${wordColors[wordCount]}">${chunk}</span>`;
          } else {
             resultHtml += chunk;
          }
          wordCount++;
        } else {
          resultHtml += chunk.replace(/\n/g, '<br>');
        }
      });
      return resultHtml;
    };

    const mapBoxToData = (box, isLeft) => ({
      text: formatTextWithColors(box),
      top: `${formatVal((box.y / 400) * 100)}%`,
      width: `${formatVal((box.w / 300) * 100)}%`,
      fontSize: `${formatVal((box.fontSizePx / 600) * 100)}vw`,
      fontWeight: box.fontWeight,
      fontFamily: box.fontFamily,
      color: box.color || '#000000',
      wordSpacing: `${formatVal(((box.wordSpacingPx || 0) / 600) * 100)}vw`,
      left: isLeft ? `${formatVal((box.x / 300) * 100)}%` : `${formatVal(((box.x - 300) / 300) * 100)}%`
    });

    const mapMaskToData = (mask, isLeft, idx, spreadIndex) => {
      const truePageIndex = (spreadIndex * 2) + (isLeft ? 0 : 1);
      
      const minX = Math.min(...mask.points.map(p => p.x));
      const minY = Math.min(...mask.points.map(p => p.y));
      const maxX = Math.max(...mask.points.map(p => p.x));
      const maxY = Math.max(...mask.points.map(p => p.y));
      const w = maxX - minX;
      const h = maxY - minY;
      
      const clipPath = `polygon(${mask.points.map(p => `${formatVal(((p.x - minX)/w)*100)}% ${formatVal(((p.y - minY)/h)*100)}%`).join(', ')})`;

      return {
        id: `title-mask-${truePageIndex}-${idx}`,
        isMask: true,
        text: "", 
        top: `${formatVal((minY / 400) * 100)}%`,
        width: `${formatVal((w / 300) * 100)}%`,
        height: `${formatVal((h / 400) * 100)}%`, 
        left: isLeft ? `${formatVal((minX / 300) * 100)}%` : `${formatVal(((minX - 300) / 300) * 100)}%`,
        clipPath: clipPath
      };
    };

    const leftText = [
        ...leftBoxes.map(b => mapBoxToData(b, true)),
        ...leftMasksArr.map((m, idx) => mapMaskToData(m, true, idx, spreadIndex))
    ];
    
    const rightText = [
        ...rightBoxes.map(b => mapBoxToData(b, false)),
        ...rightMasksArr.map((m, idx) => mapMaskToData(m, false, idx, spreadIndex))
    ];

    const timingArray = [];
    try {
      if (pageData.assemblyJsonStr.trim() !== '') {
        const newAudioData = JSON.parse(pageData.assemblyJsonStr);
        if (newAudioData.segments) {
          
          // 1. EXTRACT ALL VALID WORDS FROM SEGMENTS
          const rawWords = [];
          newAudioData.segments.forEach(segment => {
            if (segment.words) {
              segment.words.forEach(w => {
                const trimmedText = w.text.trim();
                // Filter out empty space word blocks!
                if (trimmedText !== '') {
                  rawWords.push({
                    text: trimmedText,
                    // Convert seconds to exact milliseconds!
                    start: Math.round(w.start_time * 1000), 
                    end: Math.round(w.end_time * 1000)
                  });
                }
              });
            }
          });

          // 2. IDENTIFY TITLE BOUNDARY
          let timeIndex = 0;
          let titleStartTime = 0;
          let titleEndTime = 2500; 

          const searchLimit = Math.min(rawWords.length - 1, 15);
          for (let i = 0; i < searchLimit; i++) {
            const currentWordClean = rawWords[i].text.toLowerCase().replace(/[^a-z]/g, '');
            if (currentWordClean === 'chapter') {
              // If "chapter" is found, take the very next word regardless of if it is a digit ("2") or text ("two")
              if (i + 1 < rawWords.length) {
                timeIndex = i + 2; 
                titleStartTime = rawWords[0].start;
                titleEndTime = rawWords[i + 1].end;
                break;
              }
            }
          }

          // 3. APPLY MASKS TIMING
          leftMasksArr.forEach((m, idx) => {
            const truePageIndex = (spreadIndex * 2);
            timingArray.push({
              id: `title-mask-${truePageIndex}-${idx}`,
              startTime: titleStartTime,
              endTime: titleEndTime,
              word: "TITLE_MASK"
            });
          });

          rightMasksArr.forEach((m, idx) => {
            const truePageIndex = (spreadIndex * 2) + 1;
            timingArray.push({
              id: `title-mask-${truePageIndex}-${idx}`,
              startTime: titleStartTime,
              endTime: titleEndTime,
              word: "TITLE_MASK"
            });
          });

          // 4. APPLY BODY TEXT TIMINGS
          const processBlock = (box, localSideIdx, blockIdx) => {
            const words = box.text.split(/[\s\n]+/);
            words.forEach((word, wordIdx) => {
              if (word === '-' || word.trim() === '') return;
              if (timeIndex < rawWords.length) {
                const truePageIndex = (spreadIndex * 2) + localSideIdx;
                const hasNoOffset = (timeIndex === 0);
                const isFirstBookWord = (truePageIndex === 0 && blockIdx === 0 && wordIdx === 0);
                
                const sTime = (isFirstBookWord && hasNoOffset) ? 0 : rawWords[timeIndex].start;
                const eTime = rawWords[timeIndex].end;
                
                timingArray.push({ 
                  id: `word-${truePageIndex}-${blockIdx}-${wordIdx}`, 
                  startTime: sTime,
                  endTime: eTime,
                  word: word 
                });
                timeIndex++;
              }
            });
          };

          leftBoxes.forEach((box, idx) => processBlock(box, 0, idx));
          rightBoxes.forEach((box, idx) => processBlock(box, 1, idx));
        } else if (newAudioData.timingArray) {
          timingArray.push(...newAudioData.timingArray);
        }
      }
    } catch (e) { }

    return { 
      leftText, 
      rightText, 
      timingArray, 
      imageUrl: pageData.fileObj ? "FILE_WILL_UPLOAD_TO_STORAGE" : (pageData.bgImage || "PLACEHOLDER_URL"),
      audioUrl: pageData.audioFileObj ? "AUDIO_WILL_UPLOAD_TO_STORAGE" : (pageData.audioUrl || "PLACEHOLDER_AUDIO_URL")
    };
  }, []);

  const liveCurrentPagePreview = useMemo(() => {
    return extractPageData(currentPage, currentPageIndex);
  }, [currentPage, currentPageIndex, extractPageData]);

  const handleSaveToDB = async () => {
    let parsedMeta;
    try {
      parsedMeta = JSON.parse(metaJson);
    } catch (e) {
      alert("Invalid JSON format in Book Details.");
      return;
    }
    const { 
      title, 
      description, 
      subject, 
      applicable_ages, 
      is_starter_pack, 
      format_type, 
      vibe, 
      difficulty, 
      page_count, 
      topic_tags 
    } = parsedMeta;
    
    if (!title || !title.trim()) { alert("Please enter a Title in the JSON."); return; }
    if (!applicable_ages || applicable_ages.length === 0) { alert("Please provide at least one applicable age in the JSON."); return; }

    setIsSaving(true);
    try {
      let qbData;
      
      if (quickbookId) {
        const { error: qbError } = await supabase
          .from('quickbooks')
          .update({ 
            title, 
            description, 
            subject, 
            applicable_ages, 
            is_starter_pack, 
            format_type, 
            vibe, 
            difficulty, 
            page_count, 
            topic_tags 
          })
          .eq('id', quickbookId);
          
        if (qbError) throw qbError;
        qbData = { id: quickbookId };
        
      } else {
        const { data: newQbData, error: qbError } = await supabase
          .from('quickbooks')
          .insert({ 
            title, 
            description, 
            subject, 
            applicable_ages, 
            is_starter_pack, 
            format_type, 
            vibe, 
            difficulty, 
            page_count, 
            topic_tags 
          })
          .select()
          .single();
          
        if (qbError) throw qbError;
        qbData = newQbData;
      }

      if (thumbnailObj) {
        const fileExt = thumbnailObj.name.split('.').pop();
        const fileName = `${qbData.id}-thumbnail-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('quickbook_images')
          .upload(fileName, thumbnailObj);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('quickbook_images')
          .getPublicUrl(fileName);
          
        const { error: updateError } = await supabase
          .from('quickbooks')
          .update({ thumbnail_url: publicUrlData.publicUrl })
          .eq('id', qbData.id);
          
        if (updateError) throw updateError;
      }

      const pagesPayload = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const extracted = extractPageData(p, i);
        
        let finalImageUrl = p.bgImage || "";
        let finalAudioUrl = p.audioUrl || "";

        if (p.fileObj) {
           const fileExt = p.fileObj.name.split('.').pop();
           const fileName = `${qbData.id}-page-${i}-${Date.now()}.${fileExt}`;
           
           const { error: uploadError } = await supabase.storage
             .from('quickbook_images')
             .upload(fileName, p.fileObj);
             
           if (uploadError) throw uploadError;
           
           const { data: publicUrlData } = supabase.storage
             .from('quickbook_images')
             .getPublicUrl(fileName);
             
           finalImageUrl = publicUrlData.publicUrl;
        }

        if (p.audioFileObj) {
           const audioExt = p.audioFileObj.name.split('.').pop();
           const audioName = `${qbData.id}-audio-${i}-${Date.now()}.${audioExt}`;
           
           const { error: audioUploadError } = await supabase.storage
             .from('quickbook_audio')
             .upload(audioName, p.audioFileObj);
             
           if (audioUploadError) throw audioUploadError;
           
           const { data: publicAudioUrlData } = supabase.storage
             .from('quickbook_audio')
             .getPublicUrl(audioName);
             
           finalAudioUrl = publicAudioUrlData.publicUrl;
        }

        const payload = {
          quickbook_id: qbData.id,
          page_index: i,
          image_url: finalImageUrl,
          left_text: extracted.leftText,
          right_text: extracted.rightText,
          audio_url: finalAudioUrl,
          audio_timings: extracted.timingArray
        };
        if (p.dbId) {
          payload.id = p.dbId;
        }
        pagesPayload.push(payload);
      }

      const { error: pagesError } = await supabase
        .from('quickbook_pages')
        .upsert(pagesPayload);

      if (pagesError) throw pagesError;

      // Clean up pages that were deleted in the editor
      if (quickbookId) {
        const payloadIds = pagesPayload.map(p => p.id).filter(id => id !== undefined);
        if (payloadIds.length > 0) {
          await supabase.from('quickbook_pages').delete().eq('quickbook_id', quickbookId).not('id', 'in', payloadIds);
        } else {
          // If all pages were deleted, just clear them all
          await supabase.from('quickbook_pages').delete().eq('quickbook_id', quickbookId);
        }
      }

      alert(`Success! "${title}" and its ${pages.length} pages have been ${quickbookId ? 'updated' : 'saved'} in the database.`);
    } catch (error) {
      console.error("DB Save Error:", error);
      alert("Error saving to database: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f5f5f5' }}>
      <link href="https://fonts.googleapis.com/css2?family=Chewy&family=Comic+Neue:wght@400;700&family=Fredoka:wght@400;600&family=Nunito:wght@400;600;800&family=Quicksand:wght@500;700&display=swap" rel="stylesheet" />

      {/* LEFT PANEL */}
      <div style={{ width: '300px', backgroundColor: '#fff', borderRight: '1px solid #ccc', display: 'flex', flexDirection: 'column', padding: '20px', zIndex: 10, overflowY: 'auto' }}>
        {(() => {
          let subj = "Science";
          let age = "5";
          try {
            const parsed = JSON.parse(metaJson);
            if (parsed.subject) subj = parsed.subject;
            if (parsed.applicable_ages && parsed.applicable_ages.length > 0) age = parsed.applicable_ages[0];
          } catch (e) {}
          return (
            <Link to={`/quickbooks/${subj}/${age}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#123C52', fontWeight: 'bold', marginBottom: '20px' }}>
              <ArrowLeft size={18} /> Back to Quickbooks
            </Link>
          );
        })()}

        <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '25px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', borderBottom: '2px solid #ddd', paddingBottom: '8px', marginBottom: '15px' }}>
            <BookOpen size={16} /> Book Details (JSON)
          </h3>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Paste the meta data JSON here.</p>
            <textarea 
              value={metaJson} 
              onChange={(e) => setMetaJson(e.target.value)} 
              placeholder={defaultMetaJson}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', minHeight: '180px', fontFamily: 'monospace', fontSize: '11px' }} 
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>Thumbnail</label>
            <input type="file" accept="image/*" onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
                setThumbnailObj(e.target.files[0]);
                setThumbnailUrl(URL.createObjectURL(e.target.files[0]));
              }
            }} style={{ width: '100%', fontSize: '12px' }} />
            {thumbnailUrl && (
              <div style={{ marginTop: '8px', border: '1px solid #ccc', borderRadius: '4px', padding: '4px', display: 'inline-block' }}>
                <img src={thumbnailUrl} alt="Thumbnail preview" style={{ height: '60px', objectFit: 'cover' }} />
              </div>
            )}
          </div>
        </div>

        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', fontSize: '14px' }}>Properties</h3>

        {activeBoxId && activeBox ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <button onClick={() => updateBox(activeBox.id, { fontSizePx: 24, fontWeight: '800' })} style={{ flex: 1, padding: '8px', cursor: 'pointer', backgroundColor: '#eef2f5', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                Title (24px)
              </button>
              <button onClick={() => updateBox(activeBox.id, { fontSizePx: 16, fontWeight: '600' })} style={{ flex: 1, padding: '8px', cursor: 'pointer', backgroundColor: '#eef2f5', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                Body (16px)
              </button>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}><Type size={14} /> Font Family</label>
              <select value={activeBox.fontFamily} onChange={(e) => updateBox(activeBox.id, { fontFamily: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="Nunito">Nunito</option>
                <option value="Comic Neue">Comic Neue</option>
                <option value="Fredoka">Fredoka</option>
                <option value="Quicksand">Quicksand</option>
                <option value="Chewy">Chewy</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}><Maximize size={14} /> Font Size (px)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="range" min="10" max="60" value={activeBox.fontSizePx} onChange={(e) => updateBox(activeBox.id, { fontSizePx: parseInt(e.target.value) })} style={{ flex: 1 }} />
                <input type="number" value={activeBox.fontSizePx} onChange={(e) => updateBox(activeBox.id, { fontSizePx: parseInt(e.target.value) })} style={{ width: '50px', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}><Maximize size={14} /> Word Spacing (px)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="range" min="0" max="30" value={activeBox.wordSpacingPx || 0} onChange={(e) => updateBox(activeBox.id, { wordSpacingPx: parseInt(e.target.value) })} style={{ flex: 1 }} />
                <input type="number" value={activeBox.wordSpacingPx || 0} onChange={(e) => updateBox(activeBox.id, { wordSpacingPx: parseInt(e.target.value) })} style={{ width: '50px', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}><Bold size={14} /> Font Weight</label>
              <select value={activeBox.fontWeight} onChange={(e) => updateBox(activeBox.id, { fontWeight: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="400">Regular (400)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="800">Extra-Bold (800)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                <Palette size={14} /> Default Box Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="color" value={activeBox.color || '#000000'} onChange={(e) => updateBox(activeBox.id, { color: e.target.value })} style={{ width: '40px', height: '30px', padding: '0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }} />
                <input type="text" value={activeBox.color || '#000000'} onChange={(e) => updateBox(activeBox.id, { color: e.target.value })} style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
            </div>

            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#eef2f5', borderRadius: '6px', border: '1px solid #dce4e8' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
                Highlight Specific Words
              </label>
              <p style={{ fontSize: '10px', color: '#666', margin: '0 0 10px 0', lineHeight: '1.3' }}>Double-click text, highlight target words, pick a color, and apply.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <input type="color" value={highlightColor} onChange={(e) => setHighlightColor(e.target.value)} style={{ width: '40px', height: '30px', padding: '0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }} />
                <button onClick={applyHighlight} style={{ flex: 1, padding: '8px', fontSize: '11px', background: '#26B8F5', color: '#fff', borderRadius: '4px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}>
                  Apply to Selection
                </button>
              </div>

              <button onClick={clearHighlight} style={{ width: '100%', padding: '6px', fontSize: '10px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Clear Highlight from Selection
              </button>
            </div>
            
            <div style={{ fontSize: '11px', color: '#888', marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
              <strong>Shortcuts:</strong><br />• <kbd>Delete</kbd> to remove box<br />• <kbd>Ctrl+D</kbd> to duplicate
            </div>
          </div>
        ) : activeMaskId && activeMask ? (
          <div style={{ padding: '20px 15px', textAlign: 'center', backgroundColor: '#fef1f0', border: '1px solid #fbdad8', borderRadius: '8px' }}>
            <h4 style={{ color: '#e74c3c', margin: '0 0 10px 0', fontSize: '14px' }}>Title Mask Selected</h4>
            <p style={{ fontSize: '12px', color: '#555', marginBottom: '10px', lineHeight: '1.4' }}>
              Grab any of the 4 corner handles to perfectly trace the angled shape of the title in the image!
            </p>
            <p style={{ fontSize: '12px', color: '#555', lineHeight: '1.4', fontWeight: 'bold' }}>
              It will automatically be synced to pop fully when the title audio plays.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: '14px' }}>
            Click on a text box or mask to edit properties.
          </div>
        )}
      </div>

      {/* CENTER PANEL */}
      <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '840px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Spread Editor (600x400)</h2>
          {pages.length > 1 && (
            <button 
              onClick={removeSpread}
              style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <Trash2 size={18} /> Remove Spread
            </button>
          )}
        </div>
        <div style={{ width: '840px', height: '560px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 0 20px 0' }}>
          <div 
            onMouseDown={(e) => {
              if (e.target === e.currentTarget || e.target.id === 'canvas-center-line') {
                setActiveBoxId(null);
                setActiveMaskId(null);
              }
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                  handleImageUpload({ target: { files: [file] } });
                }
              }
            }}
            style={{ 
              width: '600px', height: '400px', backgroundColor: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              position: 'relative', backgroundImage: currentPage.bgImage ? `url(${currentPage.bgImage})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden',
              transform: 'scale(1.4)', cursor: 'default' 
            }}
          >
            <div id="canvas-center-line" style={{ position: 'absolute', top: 0, bottom: 0, left: '300px', width: '2px', backgroundColor: 'red', zIndex: 5, opacity: 0.5, pointerEvents: 'none' }} />

            {(currentPage.masks || []).map(mask => (
              <DraggableMask 
                key={mask.id} mask={mask} updateMask={updateMask} removeMask={removeMask} 
                isActive={activeMaskId === mask.id} setActiveMask={(id) => { setActiveMaskId(id); setActiveBoxId(null); }}
              />
            ))}

            {currentPage.boxes.map(box => (
              <DraggableBox 
                key={box.id} box={box} updateBox={updateBox} removeBox={removeBox} 
                isActive={activeBoxId === box.id} setActiveBox={(id) => { setActiveBoxId(id); setActiveMaskId(null); }}
                setActiveSelection={setActiveSelection}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={addBox} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#123C52', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            + Add Text Box
          </button>
          <button onClick={addMask} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            + Title Mask
          </button>
          <label style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#26B8F5', color: 'white', borderRadius: '4px', fontWeight: 'bold' }}>
            Upload Background
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </label>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#fff', padding: '10px 20px', borderRadius: '30px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
          <button onClick={goToPrevPage} disabled={currentPageIndex === 0} style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'none', cursor: currentPageIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentPageIndex === 0 ? 0.3 : 1, fontWeight: 'bold' }}>
            <ChevronLeft size={20} /> Prev Spread
          </button>
          
          <span style={{ fontWeight: 'bold', color: '#123C52' }}>Spread {currentPageIndex + 1} of {pages.length}</span>
          
          <button onClick={goToNextPage} style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', color: currentPageIndex === pages.length - 1 ? '#27ae60' : 'inherit' }}>
            {currentPageIndex === pages.length - 1 ? <><Plus size={18} style={{ marginRight: '4px' }} /> Add Spread</> : <>Next Spread <ChevronRight size={20} /></>}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width: '380px', backgroundColor: '#fff', borderLeft: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #eee', flex: '0 0 auto' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '15px' }}>1. Spread Audio & Timings</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px' }}>Upload Audio for this Spread</label>
            <input type="file" accept="audio/*" onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                if (currentPage.audioUrl) URL.revokeObjectURL(currentPage.audioUrl);
                const objectUrl = URL.createObjectURL(file);
                updateCurrentPage({ audioUrl: objectUrl, audioFileObj: file });
              }
            }} style={{ width: '100%', fontSize: '11px', marginBottom: '8px' }} />
            
            {currentPage.audioUrl && (
              <audio controls src={currentPage.audioUrl} style={{ width: '100%', height: '35px', marginTop: '4px' }} />
            )}
          </div>

          <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Paste the highly-accurate JSON here.</p>
          <textarea 
            style={{ width: '100%', height: '100px', fontFamily: 'monospace', fontSize: '11px', padding: '8px' }}
            placeholder='{"language_code": "eng", "segments": ... }'
            value={currentPage.assemblyJsonStr}
            onChange={(e) => updateCurrentPage({ assemblyJsonStr: e.target.value })}
          />
        </div>

        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '14px' }}>2. DB Payload Output (Current Spread)</h3>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Notice your Title Masks automatically sync to the start of the audio!</p>
            
            <pre style={{ backgroundColor: '#1e1e1e', color: '#00ff00', padding: '15px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxHeight: '300px', overflowY: 'auto' }}>
              {`// --- left_text & right_text ---\n`}
              {JSON.stringify({ imageUrl: liveCurrentPagePreview.imageUrl, audioUrl: liveCurrentPagePreview.audioUrl, leftText: liveCurrentPagePreview.leftText, rightText: liveCurrentPagePreview.rightText }, null, 2)}
              {`\n\n// --- audio_timings ARRAY ---\n`}
              {JSON.stringify(liveCurrentPagePreview.timingArray, null, 2)}
            </pre>
          </div>

          <button 
            onClick={handleSaveToDB} 
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: 'auto', backgroundColor: isSaving ? '#ccc' : '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? "Updating Database..." : <><Save size={20} /> Update Quickbook</>}
          </button>
        </div>
      </div>
    </div>
  );
}