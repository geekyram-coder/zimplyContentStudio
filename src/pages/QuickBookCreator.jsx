import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Type, Maximize, Bold, Save, ChevronLeft, ChevronRight, Plus, BookOpen, Palette } from 'lucide-react';
import { supabase } from '../supabaseClient'; 

// --- HELPER COMPONENT: DRAGGABLE TEXT BOX ---
const DraggableBox = ({ box, updateBox, removeBox, isActive, setActiveBox, setActiveSelection }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const actionRef = useRef({ startX: 0, startY: 0, initialX: box.x, initialY: box.y, initialW: box.w });
  const textareaRef = useRef(null);

  // Sync textarea height to match content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px'; 
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [box.text, box.w, box.fontSizePx, box.fontFamily, box.fontWeight, isEditing]);

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

  // Shared styles ensure the <div> and <textarea> overlap perfectly
  const commonStyles = {
    width: '100%',
    fontFamily: `'${box.fontFamily}', sans-serif`,
    fontSize: `${box.fontSizePx}px`,
    fontWeight: box.fontWeight,
    lineHeight: '1.4',
    padding: '2px',
    boxSizing: 'border-box',
  };

  // Parses raw text into styled word spans
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
        zIndex: isActive ? 50 : 10, boxSizing: 'border-box'
      }}
    >
      {isActive && !isEditing && (
        <button 
          onClick={(e) => { e.stopPropagation(); removeBox(box.id); }} 
          style={{ position: 'absolute', top: '-26px', right: '-1px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
        >Delete</button>
      )}
      
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        
        {/* VISUAL LAYER: Shows the colorful words when not editing */}
        <div
          onMouseDown={!isEditing ? startDrag : undefined}
          onDoubleClick={!isEditing ? handleDoubleClick : undefined}
          style={{
            ...commonStyles,
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            cursor: isEditing ? 'text' : 'move',
            opacity: isEditing ? 0 : 1, // Hides when typing
            pointerEvents: isEditing ? 'none' : 'auto',
            zIndex: 1
          }}
        >
          {renderColoredText()}
        </div>

        {/* INPUT LAYER: Pure textarea for fast editing. Overlays exactly on top of visual layer */}
        <textarea
          ref={textareaRef} 
          value={box.text} 
          onChange={(e) => updateBox(box.id, { text: e.target.value })}
          onBlur={() => setIsEditing(false)} 
          onSelect={handleSelectionChange}
          onKeyUp={handleSelectionChange} // Catches shift+arrow keyboard selections
          style={{
            ...commonStyles,
            position: 'relative', // Forces the parent container to grow dynamically
            background: 'transparent', border: 'none', outline: 'none', resize: 'none', 
            color: box.color || '#000000', overflow: 'hidden', 
            opacity: isEditing ? 1 : 0, // Appears when typing
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
export default function QuickBookCreator() {
  const defaultMetaJson = `{\n  "title": "",\n  "description": "",\n  "subject": "Science",\n  "category": "",\n  "ages": [5, 6, 7]\n}`;
  const [metaJson, setMetaJson] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailObj, setThumbnailObj] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  const [pages, setPages] = useState([{ id: 'page-0', bgImage: null, fileObj: null, boxes: [], assemblyJsonStr: '' }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [activeSelection, setActiveSelection] = useState({ start: 0, end: 0, boxId: null });
  const [highlightColor, setHighlightColor] = useState('#e74c3c');

  const currentPage = pages[currentPageIndex];
  const activeBox = currentPage.boxes.find(b => b.id === activeBoxId);

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    return () => pagesRef.current.forEach(p => { if (p.bgImage) URL.revokeObjectURL(p.bgImage); });
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
      setPages(prev => [...prev, { id: `page-${Date.now()}`, bgImage: null, fileObj: null, boxes: [], assemblyJsonStr: '' }]);
    }
    setCurrentPageIndex(prev => prev + 1);
    setActiveBoxId(null);
    setActiveSelection({ start: 0, end: 0, boxId: null });
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
      setActiveBoxId(null);
      setActiveSelection({ start: 0, end: 0, boxId: null });
    }
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
    const newBox = { id: newId, text: "New text block", x: 50, y: 50, w: 200, fontSizePx: 14, fontWeight: "600", fontFamily: "Nunito", color: "#000000", wordColors: {} };
    updateCurrentPage({ boxes: [...currentPage.boxes, newBox] });
    setActiveBoxId(newId);
  };

  const updateBox = useCallback((id, updates) => {
    updateCurrentPage({ boxes: currentPage.boxes.map(b => b.id === id ? { ...b, ...updates } : b) });
  }, [currentPage, updateCurrentPage]);

  const removeBox = useCallback((id) => {
    updateCurrentPage({ boxes: currentPage.boxes.filter(b => b.id !== id) });
    setActiveBoxId(prev => (prev === id ? null : prev));
  }, [currentPage, updateCurrentPage]);

  const duplicateBox = useCallback((id) => {
    const sourceBox = currentPage.boxes.find(b => b.id === id);
    if (!sourceBox) return;
    const newId = Date.now().toString();
    const newBox = { ...sourceBox, id: newId, x: Math.min(sourceBox.x + 20, 600 - sourceBox.w), y: Math.min(sourceBox.y + 20, 400 - 30) };
    updateCurrentPage({ boxes: [...currentPage.boxes, newBox] });
    setActiveBoxId(newId);
  }, [currentPage, updateCurrentPage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (activeBoxId) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBox(activeBoxId); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateBox(activeBoxId); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBoxId, removeBox, duplicateBox]);

  // --- HIGHLIGHTING LOGIC ---
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

    // Map string coordinates to actual word positions
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
    const formatVal = (val) => parseFloat(val.toFixed(2));

    [...pageData.boxes]
      .sort((a, b) => a.y - b.y)
      .forEach(box => {
        if ((box.x + box.w / 2) < 300) leftBoxes.push(box);
        else rightBoxes.push(box);
      });

    // Weaves the custom colors into the final HTML output for React Native
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
      left: isLeft ? `${formatVal((box.x / 300) * 100)}%` : `${formatVal(((box.x - 300) / 300) * 100)}%`
    });

    const leftText = leftBoxes.map(b => mapBoxToData(b, true));
    const rightText = rightBoxes.map(b => mapBoxToData(b, false));

    const timingArray = [];
    try {
      if (pageData.assemblyJsonStr.trim() !== '') {
        const assemblyData = JSON.parse(pageData.assemblyJsonStr);
        if (assemblyData.words) {
          const rawTimestamps = assemblyData.words.map(w => w.start);
          let timeIndex = 0;

          // Pure raw text is used for audio mapping so the HTML tags don't corrupt the word count
          const processBlock = (box, localSideIdx, blockIdx) => {
            const words = box.text.split(/[\s\n]+/);
            words.forEach((word, wordIdx) => {
              if (word === '-' || word.trim() === '') return;
              if (timeIndex < rawTimestamps.length) {
                const truePageIndex = (spreadIndex * 2) + localSideIdx;
                const time = (truePageIndex === 0 && blockIdx === 0 && wordIdx === 0) ? 0 : rawTimestamps[timeIndex];
                timingArray.push({ id: `word-${truePageIndex}-${blockIdx}-${wordIdx}`, time });
                timeIndex++;
              }
            });
          };

          leftBoxes.forEach((box, idx) => processBlock(box, 0, idx));
          rightBoxes.forEach((box, idx) => processBlock(box, 1, idx));
        }
      }
    } catch (e) { }

    return { 
      leftText, 
      rightText, 
      timingArray, 
      imageUrl: pageData.fileObj ? "FILE_WILL_UPLOAD_TO_STORAGE" : "PLACEHOLDER_URL" 
    };
  }, []);

  const liveCurrentPagePreview = useMemo(() => {
    return extractPageData(currentPage, currentPageIndex);
  }, [currentPage, currentPageIndex, extractPageData]);

  // --- DB SAVE LOGIC ---
  const handleSaveToDB = async () => {
    let parsedMeta;
    try {
      parsedMeta = JSON.parse(metaJson);
    } catch (e) {
      alert("Invalid JSON format in Book Details.");
      return;
    }
    const { title, subject, category, description, ages: applicableAges } = parsedMeta;
    
    if (!title || !title.trim()) { alert("Please enter a Title in the JSON."); return; }
    if (!applicableAges || applicableAges.length === 0) { alert("Please provide at least one applicable age in the JSON."); return; }

    setIsSaving(true);
    try {
      const { data: qbData, error: qbError } = await supabase
        .from('quickbooks')
        .insert({ title, subject, category, description, applicable_ages: applicableAges })
        .select()
        .single();

      if (qbError) throw qbError;

      if (thumbnailObj) {
        const fileExt = thumbnailObj.name.split('.').pop();
        const fileName = `${qbData.id}-thumbnail.${fileExt}`;
        
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
        let finalImageUrl = extracted.imageUrl;

        if (p.fileObj) {
           const fileExt = p.fileObj.name.split('.').pop();
           const fileName = `${qbData.id}-page-${i}.${fileExt}`;
           
           const { data: uploadData, error: uploadError } = await supabase.storage
             .from('quickbook_images')
             .upload(fileName, p.fileObj);
             
           if (uploadError) throw uploadError;
           
           const { data: publicUrlData } = supabase.storage
             .from('quickbook_images')
             .getPublicUrl(fileName);
             
           finalImageUrl = publicUrlData.publicUrl;
        }

        pagesPayload.push({
          quickbook_id: qbData.id,
          page_index: i,
          image_url: finalImageUrl,
          left_text: extracted.leftText,
          right_text: extracted.rightText,
          audio_url: "",
          audio_timings: extracted.timingArray
        });
      }

      const { error: pagesError } = await supabase
        .from('quickbook_pages')
        .insert(pagesPayload);

      if (pagesError) throw pagesError;

      alert(`Success! "${title}" and its ${pages.length} pages have been saved to the database.`);
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#123C52', fontWeight: 'bold', marginBottom: '20px' }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>

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

        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', fontSize: '14px' }}>Text Properties</h3>

        {activeBox ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <button onClick={() => updateBox(activeBox.id, { fontSizePx: 24, fontWeight: '800' })} style={{ flex: 1, padding: '8px', cursor: 'pointer', backgroundColor: '#eef2f5', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                Title (24px)
              </button>
              <button onClick={() => updateBox(activeBox.id, { fontSizePx: 14, fontWeight: '600' })} style={{ flex: 1, padding: '8px', cursor: 'pointer', backgroundColor: '#eef2f5', border: '1px solid #ccc', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                Body (14px)
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}><Bold size={14} /> Font Weight</label>
              <select value={activeBox.fontWeight} onChange={(e) => updateBox(activeBox.id, { fontWeight: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="400">Regular (400)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="800">Extra-Bold (800)</option>
              </select>
            </div>

            {/* BASE COLOR PICKER */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
                <Palette size={14} /> Default Box Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="color" value={activeBox.color || '#000000'} onChange={(e) => updateBox(activeBox.id, { color: e.target.value })} style={{ width: '40px', height: '30px', padding: '0', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }} />
                <input type="text" value={activeBox.color || '#000000'} onChange={(e) => updateBox(activeBox.id, { color: e.target.value })} style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
            </div>

            {/* WORD HIGHLIGHTER TOOL */}
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
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: '14px' }}>
            Click on a text box on the canvas to edit its properties.
          </div>
        )}
      </div>

      {/* CENTER PANEL: Canvas & Navigation */}
      <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        
        <h2 style={{ marginBottom: '20px' }}>Spread Editor (600x400)</h2>
        
        <div style={{ width: '840px', height: '560px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0' }}>
          
          <div 
            onMouseDown={(e) => {
              if (e.target === e.currentTarget || e.target.id === 'canvas-center-line') setActiveBoxId(null);
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

            {currentPage.boxes.map(box => (
              <DraggableBox 
                key={box.id} box={box} updateBox={updateBox} removeBox={removeBox} 
                isActive={activeBoxId === box.id} setActiveBox={setActiveBoxId}
                setActiveSelection={setActiveSelection}
              />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={addBox} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#123C52', color: 'white', border: 'none', borderRadius: '4px' }}>
            + Add Text Box
          </button>
          <label style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#26B8F5', color: 'white', borderRadius: '4px' }}>
            Upload Background
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </label>
        </div>

        {/* Fast Navigation */}
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
          <h3 style={{ fontSize: '14px' }}>1. AssemblyAI JSON (Current Spread)</h3>
          <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Paste the JSON for the audio covering *this* 2-page spread.</p>
          <textarea 
            style={{ width: '100%', height: '100px', fontFamily: 'monospace', fontSize: '11px', padding: '8px' }}
            placeholder='{"words": [{"text": "The", "start": 97} ... ]}'
            value={currentPage.assemblyJsonStr}
            onChange={(e) => updateCurrentPage({ assemblyJsonStr: e.target.value })}
          />
        </div>

        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '14px' }}>2. DB Payload Output (Current Spread)</h3>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Notice how custom colors generate internal &lt;span&gt; tags!</p>
            
            <pre style={{ backgroundColor: '#1e1e1e', color: '#00ff00', padding: '15px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'pre-wrap', wordWrap: 'break-word', maxHeight: '300px', overflowY: 'auto' }}>
              {`// --- left_text & right_text ---\n`}
              {JSON.stringify({ imageUrl: liveCurrentPagePreview.imageUrl, leftText: liveCurrentPagePreview.leftText, rightText: liveCurrentPagePreview.rightText }, null, 2)}
              {`\n\n// --- audio_timings ARRAY ---\n`}
              {JSON.stringify(liveCurrentPagePreview.timingArray, null, 2)}
            </pre>
          </div>

          <button 
            onClick={handleSaveToDB} 
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: 'auto', backgroundColor: isSaving ? '#ccc' : '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer' }}
          >
            {isSaving ? "Saving to Database..." : <><Save size={20} /> Publish Full Book</>}
          </button>
        </div>
      </div>
    </div>
  );
}