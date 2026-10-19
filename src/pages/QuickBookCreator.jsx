import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Type, Maximize, Bold, Save, ChevronLeft, ChevronRight, Plus, BookOpen, Palette, Trash2 } from 'lucide-react';
import { supabase, ensureSession } from '../supabaseClient'; 
import { uploadFileToR2 } from '../r2Client';
import { resizeImageToPng } from '../utils/imageProcessing';

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

// --- HELPERS: RICH TEXT EDITING (per-word weight/color stay visible while editing) ---
const escapeEditorHtml = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Builds the editing DOM from the box model. Each word carries its own style and its
// word index (data-wi) so styles can follow their words while the text is being typed.
const buildEditorHtml = (box) => {
  const text = box.text || '';
  const chunks = text.match(/\S+|\s+/g) || [];
  let wordCount = 0;
  let html = '';
  chunks.forEach(chunk => {
    if (/\S/.test(chunk)) {
      const styles = [];
      if (box.wordColors && box.wordColors[wordCount]) styles.push(`color:${box.wordColors[wordCount]}`);
      if (box.wordWeights && box.wordWeights[wordCount]) styles.push(`font-weight:${box.wordWeights[wordCount]}`);
      html += `<span data-wi="${wordCount}"${styles.length ? ` style="${styles.join(';')}"` : ''}>${escapeEditorHtml(chunk)}</span>`;
      wordCount++;
    } else {
      html += escapeEditorHtml(chunk);
    }
  });
  // Placeholder so an empty box / trailing new line still gets a visible line
  if (text === '' || text.endsWith('\n')) html += '<br>';
  return html;
};

// Reads plain text back from the editing DOM, plus (per character) the word index it came from.
const readEditorDom = (root) => {
  let text = '';
  const sources = [];
  const walk = (node, src) => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.nodeValue.replace(/ /g, ' ');
        text += value;
        for (let i = 0; i < value.length; i++) sources.push(src);
      } else if (child.nodeName === 'BR') {
        // layout placeholder only; new lines are stored as "\n" text
      } else if (child.nodeName === 'DIV' || child.nodeName === 'P') {
        if (text !== '' && !text.endsWith('\n')) { text += '\n'; sources.push(null); }
        walk(child, src);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const wi = child.getAttribute('data-wi');
        walk(child, wi !== null ? Number(wi) : src);
      }
    });
  };
  walk(root, null);
  return { text, sources };
};

// Word index of every character of the current model text (null for whitespace)
const modelCharSources = (text) => {
  const sources = new Array(text.length).fill(null);
  const re = /\S+/g;
  let m;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) sources[i] = idx;
    idx++;
  }
  return sources;
};

// Re-keys per-word styles after a text edit so each style stays on the word it was applied to
const remapWordStyles = (box, newText, sources) => {
  const oldWeights = box.wordWeights || {};
  const oldColors = box.wordColors || {};
  const wordWeights = {};
  const wordColors = {};
  const re = /\S+/g;
  let m;
  let idx = 0;
  while ((m = re.exec(newText)) !== null) {
    let src = null;
    for (let i = m.index; i < m.index + m[0].length; i++) {
      if (sources[i] !== null && sources[i] !== undefined) { src = sources[i]; break; }
    }
    if (src !== null) {
      if (oldWeights[src]) wordWeights[idx] = oldWeights[src];
      if (oldColors[src]) wordColors[idx] = oldColors[src];
    }
    idx++;
  }
  return { wordWeights, wordColors };
};

const getEditorSelection = (root) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const offsetOf = (container, offset) => {
    const r = document.createRange();
    r.selectNodeContents(root);
    r.setEnd(container, offset);
    return readEditorDom(r.cloneContents()).text.length;
  };
  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
};

const setEditorSelection = (root, start, end) => {
  const textNodes = [];
  const collect = (node) => node.childNodes.forEach(c => {
    if (c.nodeType === Node.TEXT_NODE) textNodes.push(c); else collect(c);
  });
  collect(root);
  const total = textNodes.reduce((sum, n) => sum + n.nodeValue.length, 0);
  const locate = (target) => {
    if (target >= total && root.lastChild && root.lastChild.nodeName === 'BR') {
      return { node: root, offset: root.childNodes.length - 1 };
    }
    let acc = 0;
    for (const node of textNodes) {
      const len = node.nodeValue.length;
      if (target <= acc + len) return { node, offset: target - acc };
      acc += len;
    }
    return { node: root, offset: root.childNodes.length };
  };
  const s = locate(start);
  const e = locate(end);
  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

const getTextOffsetFromPoint = (root, x, y) => {
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (!node || !root.contains(node)) return null;
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(node, offset);
  return r.toString().length;
};

// --- HELPER COMPONENT: DRAGGABLE TEXT BOX ---
const DraggableBox = ({ box, updateBox, removeBox, isActive, setActiveBox, setActiveSelection }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const actionRef = useRef({ startX: 0, startY: 0, initialX: box.x, initialY: box.y, initialW: box.w });
  const editorRef = useRef(null);
  const displayRef = useRef(null);
  const renderedHtmlRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const isComposingRef = useRef(false);
  const historyRef = useRef({ undo: [], redo: [], lastPush: 0, lastCoalesce: false });
  const snapshotRef = useRef({ text: box.text, wordWeights: box.wordWeights, wordColors: box.wordColors });
  const changeSourceRef = useRef(null);

  const editorHtml = buildEditorHtml(box);

  // Keep the editing DOM in sync with the model, preserving the caret / selection
  React.useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || isComposingRef.current) return;
    const hasFocus = document.activeElement === el;
    const usePending = hasFocus && pendingSelectionRef.current;
    if (renderedHtmlRef.current === editorHtml && !usePending) return;
    const selection = usePending ? pendingSelectionRef.current : (hasFocus ? getEditorSelection(el) : null);
    if (usePending) pendingSelectionRef.current = null;
    if (renderedHtmlRef.current !== editorHtml) {
      el.innerHTML = editorHtml;
      renderedHtmlRef.current = editorHtml;
    }
    if (selection && hasFocus) setEditorSelection(el, selection.start, selection.end);
  });

  // Undo history (covers typing and per-word style changes made while the box is active)
  useEffect(() => {
    const prev = snapshotRef.current;
    if (prev.text === box.text && prev.wordWeights === box.wordWeights && prev.wordColors === box.wordColors) return;
    const source = changeSourceRef.current;
    changeSourceRef.current = null;
    if (source === null) {
      const h = historyRef.current;
      h.undo.push(prev);
      if (h.undo.length > 200) h.undo.shift();
      h.redo = [];
      h.lastCoalesce = false;
    }
    snapshotRef.current = { text: box.text, wordWeights: box.wordWeights, wordColors: box.wordColors };
  }, [box.text, box.wordWeights, box.wordColors]);

  useEffect(() => {
    if (!isActive) setIsEditing(false);
  }, [isActive]);

  useEffect(() => {
    if (isEditing && editorRef.current) {
      const el = editorRef.current;
      el.focus();
      const len = (box.text || '').length;
      const sel = pendingSelectionRef.current || { start: len, end: len };
      pendingSelectionRef.current = null;
      setEditorSelection(el, sel.start, sel.end);
    }
  }, [isEditing]);

  // Report the selected range (as plain-text offsets) to the properties panel
  useEffect(() => {
    if (!isEditing) return;
    const onSelectionChange = () => {
      const el = editorRef.current;
      if (!el) return;
      const sel = getEditorSelection(el);
      if (!sel) return;
      setActiveSelection(prev => (prev.boxId === box.id && prev.start === sel.start && prev.end === sel.end) ? prev : { start: sel.start, end: sel.end, boxId: box.id });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [isEditing, box.id, setActiveSelection]);

  const recordHistory = (coalesce) => {
    const h = historyRef.current;
    const now = Date.now();
    if (!(coalesce && h.lastCoalesce && now - h.lastPush < 1000)) {
      h.undo.push(snapshotRef.current);
      if (h.undo.length > 200) h.undo.shift();
    }
    h.lastPush = now;
    h.lastCoalesce = coalesce;
    h.redo = [];
  };

  const commitEditorText = (newText, sources, selection, coalesce) => {
    const styles = remapWordStyles(box, newText, sources);
    recordHistory(coalesce);
    changeSourceRef.current = 'editor';
    if (selection) pendingSelectionRef.current = selection;
    updateBox(box.id, { text: newText, wordWeights: styles.wordWeights, wordColors: styles.wordColors });
  };

  const insertPlainText = (str) => {
    const el = editorRef.current;
    if (!el) return;
    const text = box.text || '';
    const sel = getEditorSelection(el) || { start: text.length, end: text.length };
    const oldSources = modelCharSources(text);
    const newText = text.slice(0, sel.start) + str + text.slice(sel.end);
    const sources = [...oldSources.slice(0, sel.start), ...new Array(str.length).fill(null), ...oldSources.slice(sel.end)];
    const caret = sel.start + str.length;
    commitEditorText(newText, sources, { start: caret, end: caret }, false);
  };

  const handleEditorInput = () => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    const { text: newText, sources } = readEditorDom(el);
    if (newText !== (box.text || '')) {
      commitEditorText(newText, sources, null, true);
    } else {
      // Text unchanged (e.g. browser-inserted formatting): restore the model's rendering
      const sel = getEditorSelection(el);
      el.innerHTML = editorHtml;
      renderedHtmlRef.current = editorHtml;
      if (sel) setEditorSelection(el, sel.start, sel.end);
    }
  };

  const applyHistory = (fromKey, toKey) => {
    const h = historyRef.current;
    if (h.undo.length === 0 && fromKey === 'undo') return;
    if (h.redo.length === 0 && fromKey === 'redo') return;
    const target = h[fromKey].pop();
    h[toKey].push(snapshotRef.current);
    h.lastCoalesce = false;
    const el = editorRef.current;
    const currentText = box.text || '';
    const targetText = target.text || '';
    let selection = el ? getEditorSelection(el) : null;
    if (targetText !== currentText) {
      let suffix = 0;
      while (suffix < targetText.length && suffix < currentText.length &&
             targetText[targetText.length - 1 - suffix] === currentText[currentText.length - 1 - suffix]) suffix++;
      const caret = targetText.length - suffix;
      selection = { start: caret, end: caret };
    }
    changeSourceRef.current = 'history';
    if (selection) pendingSelectionRef.current = selection;
    updateBox(box.id, { text: target.text, wordWeights: target.wordWeights, wordColors: target.wordColors });
  };

  const handleEditorKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter') {
      e.preventDefault();
      insertPlainText('\n');
    } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      applyHistory('undo', 'redo');
    } else if (mod && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      applyHistory('redo', 'undo');
    } else if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
      e.preventDefault(); // keep the browser's own rich formatting out of the text
    }
  };

  const handleEditorPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    if (pasted) insertPlainText(pasted);
  };

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
    // Start editing with the double-clicked word selected
    const text = box.text || '';
    const offset = displayRef.current ? getTextOffsetFromPoint(displayRef.current, e.clientX, e.clientY) : null;
    if (offset !== null) {
      let selection = { start: offset, end: offset };
      const re = /\S+/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (offset >= m.index && offset < m.index + m[0].length) {
          selection = { start: m.index, end: m.index + m[0].length };
          break;
        }
      }
      pendingSelectionRef.current = selection;
    }
    setIsEditing(true);
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
        const fontWeight = (box.wordWeights && box.wordWeights[wordCount]) ? box.wordWeights[wordCount] : undefined;
        wordCount++;
        return <span key={i} style={{ color, fontWeight }}>{chunk}</span>;
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
          ref={displayRef}
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

        <div
          ref={editorRef}
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck
          onInput={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onPaste={handleEditorPaste}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; handleEditorInput(); }}
          onBlur={() => setIsEditing(false)}
          style={{
            ...commonStyles,
            position: 'relative',
            display: 'inline-block', verticalAlign: 'baseline', // same line-box footprint as the previous <textarea>
            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            background: 'transparent', border: 'none', outline: 'none',
            color: box.color || '#000000', overflow: 'hidden',
            cursor: 'text',
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
import { useSearchParams } from 'react-router-dom';
import { saveDraft, loadDraft, deleteDraft } from '../utils/draftManager';

export default function QuickBookCreator() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [draftId, setDraftId] = useState(() => searchParams.get('draftId') || `draft-${Date.now()}`);
  const [isDraftLoading, setIsDraftLoading] = useState(true);
  
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [activeMaskId, setActiveMaskId] = useState(null);
  const [activeSelection, setActiveSelection] = useState({ start: 0, end: 0, boxId: null });
  const [highlightColor, setHighlightColor] = useState('#e74c3c');

  const currentPage = pages[currentPageIndex];
  const activeBox = currentPage.boxes.find(b => b.id === activeBoxId);
  const activeMask = (currentPage.masks || []).find(m => m.id === activeMaskId);

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    return () => pagesRef.current.forEach(p => { 
      if (p.bgImage && p.bgImage.startsWith('blob:')) URL.revokeObjectURL(p.bgImage);
      if (p.audioUrl && p.audioUrl.startsWith('blob:')) URL.revokeObjectURL(p.audioUrl);
    });
  }, []);

  // INITIAL LOAD OF DRAFT
  useEffect(() => {
    async function initDraft() {
      const draftData = await loadDraft(draftId);
      if (draftData) {
        if (draftData.metaJson) setMetaJson(draftData.metaJson);
        if (draftData.thumbnailObj) {
          setThumbnailObj(draftData.thumbnailObj);
          setThumbnailUrl(URL.createObjectURL(draftData.thumbnailObj));
        } else if (draftData.thumbnailUrl) {
          setThumbnailUrl(draftData.thumbnailUrl);
        }
        if (draftData.pages && draftData.pages.length > 0) {
          // Recreate blob URLs for file objects
          const restoredPages = draftData.pages.map(p => {
            let restoredBg = p.bgImage;
            let restoredAudioUrl = p.audioUrl;
            if (p.fileObj) {
               // We don't recreate blob if it was already stored, wait, Blobs can't be used across sessions directly by URL, 
               // but localforage stores the actual File/Blob object! So we must create new ObjectURLs for them.
               restoredBg = URL.createObjectURL(p.fileObj);
            }
            if (p.audioFileObj) {
               restoredAudioUrl = URL.createObjectURL(p.audioFileObj);
            }
            return {
              ...p,
              bgImage: restoredBg,
              audioUrl: restoredAudioUrl
            };
          });
          setPages(restoredPages);
        }
        if (draftData.currentPageIndex !== undefined) {
          setCurrentPageIndex(draftData.currentPageIndex);
        }
      } else {
        // Leave metaJson empty so the placeholder shows through
      }
      setIsDraftLoading(false);
      // Ensure the URL matches the draft ID without pushing to history loop
      if (!searchParams.get('draftId')) {
        setSearchParams({ draftId }, { replace: true });
      }
    }
    initDraft();
  }, []);

  // AUTO-SAVE DRAFT
  useEffect(() => {
    if (isDraftLoading) return;

    // Check if the draft is completely empty (no edits at all)
    const isEmpty = metaJson === '' && 
                    thumbnailObj === null && 
                    pages.length === 1 && 
                    pages[0].bgImage === null && 
                    pages[0].boxes.length === 0 && 
                    pages[0].masks.length === 0 && 
                    pages[0].audioUrl === null;

    if (isEmpty) return; // Don't auto-save a blank canvas

    const timeout = setTimeout(() => {
      saveDraft(draftId, {
        metaJson,
        thumbnailObj,
        pages,
        currentPageIndex
      });
    }, 1000); // 1s debounce
    return () => clearTimeout(timeout);
  }, [metaJson, thumbnailObj, pages, currentPageIndex, draftId, isDraftLoading]);

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
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
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

  const setWordWeight = (weight) => {
    if (!activeBoxId || activeSelection.boxId !== activeBoxId) return;
    const box = currentPage.boxes.find(b => b.id === activeBoxId);
    if (!box) return;

    const { start, end } = activeSelection;
    if (start === end) {
      alert("Please highlight/select some words in the text box first.");
      return;
    }

    const newWordWeights = { ...(box.wordWeights || {}) };
    const wordRegex = /\S+/g;
    let match;
    let wordCount = 0;

    while ((match = wordRegex.exec(box.text)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (start < wordEnd && end > wordStart) {
        newWordWeights[wordCount] = weight;
      }
      wordCount++;
    }
    updateBox(activeBoxId, { wordWeights: newWordWeights });
  };

  const clearWordWeight = () => {
    if (!activeBoxId || activeSelection.boxId !== activeBoxId) return;
    const box = currentPage.boxes.find(b => b.id === activeBoxId);
    if (!box) return;

    const { start, end } = activeSelection;
    if (start === end) return;

    const newWordWeights = { ...(box.wordWeights || {}) };
    const wordRegex = /\S+/g;
    let match;
    let wordCount = 0;

    while ((match = wordRegex.exec(box.text)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (start < wordEnd && end > wordStart) {
        delete newWordWeights[wordCount];
      }
      wordCount++;
    }
    updateBox(activeBoxId, { wordWeights: newWordWeights });
  };

  const selectedWordsWeight = (() => {
    if (!activeBox || activeSelection.boxId !== activeBox.id || activeSelection.start === activeSelection.end) return null;
    const weights = new Set();
    const wordRegex = /\S+/g;
    let match;
    let wordCount = 0;
    while ((match = wordRegex.exec(activeBox.text || '')) !== null) {
      if (activeSelection.start < match.index + match[0].length && activeSelection.end > match.index) {
        weights.add(String((activeBox.wordWeights && activeBox.wordWeights[wordCount]) || activeBox.fontWeight));
      }
      wordCount++;
    }
    return weights.size === 1 ? [...weights][0] : null;
  })();

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
      const wordWeights = box.wordWeights || {};
      const wordRegex = /\S+|\s+/g;
      let wordCount = 0;
      const chunks = text.match(wordRegex) || [];

      let resultHtml = "";
      chunks.forEach(chunk => {
        if (/\S/.test(chunk)) {
          const styleParts = [];
          if (wordColors[wordCount]) styleParts.push(`color:${wordColors[wordCount]}`);
          if (wordWeights[wordCount]) styleParts.push(`font-weight:${wordWeights[wordCount]}`);
          if (styleParts.length > 0) {
             resultHtml += `<span style="${styleParts.join(';')}">${chunk}</span>`;
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
        }
      }
    } catch (e) { }

    return { 
      leftText, 
      rightText, 
      timingArray, 
      imageUrl: pageData.fileObj ? "FILE_WILL_UPLOAD_TO_STORAGE" : "PLACEHOLDER_URL",
      audioUrl: pageData.audioFileObj ? "AUDIO_WILL_UPLOAD_TO_STORAGE" : "PLACEHOLDER_AUDIO_URL"
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
      await ensureSession();
      const { data: qbData, error: qbError } = await supabase
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

      if (thumbnailObj) {
        const fileExt = thumbnailObj.name.split('.').pop();
        const fileName = `${qbData.id}-thumbnail.${fileExt}`;
        const originalKey = `quickbook_images/${fileName}`;
        
        await uploadFileToR2(thumbnailObj, originalKey, thumbnailObj.type);
        
        const resizedBlob = await resizeImageToPng(thumbnailObj);
        const lastDotIdx = originalKey.lastIndexOf('.');
        const baseKey = lastDotIdx > -1 ? originalKey.substring(0, lastDotIdx) : originalKey;
        const derivedKey = `derived/w720/${baseKey}.png`;
        
        const derivedUrl = await uploadFileToR2(resizedBlob, derivedKey, 'image/png');
          
        const { error: updateError } = await supabase
          .from('quickbooks')
          .update({ thumbnail_url: derivedUrl })
          .eq('id', qbData.id);
          
        if (updateError) throw updateError;
      }

      const pagesPayload = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const extracted = extractPageData(p, i);
        
        let finalImageUrl = "";
        let finalAudioUrl = "";

        if (p.fileObj) {
           const fileExt = p.fileObj.name.split('.').pop();
           const fileName = `${qbData.id}-page-${i}.${fileExt}`;
           const originalKey = `quickbook_images/${fileName}`;
           
           await uploadFileToR2(p.fileObj, originalKey, p.fileObj.type);
           
           const resizedBlob = await resizeImageToPng(p.fileObj);
           const lastDotIdx = originalKey.lastIndexOf('.');
           const baseKey = lastDotIdx > -1 ? originalKey.substring(0, lastDotIdx) : originalKey;
           const derivedKey = `derived/w720/${baseKey}.png`;
           
           finalImageUrl = await uploadFileToR2(resizedBlob, derivedKey, 'image/png');
        }

        if (p.audioFileObj) {
           const audioExt = p.audioFileObj.name.split('.').pop();
           const audioName = `${qbData.id}-audio-${i}.${audioExt}`;
           const originalKey = `quickbook_audio/${audioName}`;
           
           finalAudioUrl = await uploadFileToR2(p.audioFileObj, originalKey, p.audioFileObj.type);
        }

        pagesPayload.push({
          quickbook_id: qbData.id,
          page_index: i,
          image_url: finalImageUrl,
          left_text: extracted.leftText,
          right_text: extracted.rightText,
          audio_url: finalAudioUrl,
          audio_timings: extracted.timingArray
        });
      }

      const { error: pagesError } = await supabase
        .from('quickbook_pages')
        .insert(pagesPayload);

      if (pagesError) throw pagesError;

      // Clear the draft from indexedDB successfully!
      await deleteDraft(draftId);

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

            <div style={{ padding: '12px', backgroundColor: '#eef2f5', borderRadius: '6px', border: '1px solid #dce4e8' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>
                <Bold size={14} /> Weight for Specific Words
              </label>
              <p style={{ fontSize: '10px', color: '#666', margin: '0 0 10px 0', lineHeight: '1.3' }}>Double-click text and select words, then click a weight. It applies instantly and the words stay selected.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                {[['400', 'Regular'], ['600', 'Semi-Bold'], ['800', 'Extra-Bold']].map(([weight, label]) => {
                  const isCurrent = selectedWordsWeight === weight;
                  return (
                    <button
                      key={weight}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setWordWeight(weight)}
                      style={{ flex: 1, padding: '8px 4px', fontSize: '11px', fontWeight: weight, background: isCurrent ? '#26B8F5' : '#fff', color: isCurrent ? '#fff' : '#333', border: isCurrent ? '1px solid #26B8F5' : '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button onMouseDown={(e) => e.preventDefault()} onClick={clearWordWeight} style={{ width: '100%', padding: '6px', fontSize: '10px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Clear Weight from Selection
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

          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
            <button 
              onClick={async () => {
                const success = await saveDraft(draftId, { metaJson, thumbnailObj, pages, currentPageIndex });
                if (success) alert('Draft saved successfully!');
                else alert('Failed to save draft.');
              }} 
              disabled={isSaving}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
            >
              <Save size={18} /> Save Draft
            </button>
            <button 
              onClick={handleSaveToDB} 
              disabled={isSaving}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', backgroundColor: isSaving ? '#ccc' : '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer' }}
            >
              {isSaving ? "Saving..." : <><Save size={20} /> Publish Full Book</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}