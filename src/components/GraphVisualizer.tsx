import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GraphTopology, GraphNodeData } from '../types';
import { Search, ZoomIn, ZoomOut, RotateCcw, ExternalLink, X, Activity, Layers, Sparkles } from 'lucide-react';

interface GraphVisualizerProps {
  highlightNodes?: string[];
  eligibleSchemes?: string[];
  missingDocuments?: string[];
  heldDocuments?: string[];
}

interface NodeCoordinate {
  x: number;
  y: number;
  origX: number;
  origY: number;
  phase: number;
}

export const GraphVisualizer: React.FC<GraphVisualizerProps> = ({
  highlightNodes = [],
  eligibleSchemes = [],
  missingDocuments = [],
  heldDocuments = []
}) => {
  const [topology, setTopology] = useState<GraphTopology | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Scheme' | 'Document' | 'Office' | 'Criterion'>('all');
  const [layoutMode, setLayoutMode] = useState<'pipeline' | 'constellation'>('pipeline');
  const [floatAnimationActive, setFloatAnimationActive] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Node coordinates map that supports dragging and floating physics
  const [positions, setPositions] = useState<Map<string, NodeCoordinate>>(new Map());

  // Dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Load Topology
  useEffect(() => {
    fetch('/api/graph/topology')
      .then(res => res.json())
      .then((data: GraphTopology) => {
        setTopology(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load topology:', err);
        setLoading(false);
      });
  }, []);

  // Compute Base Layout Coordinates based on layoutMode
  const computeBaseLayout = useCallback(
    (topo: GraphTopology, mode: 'pipeline' | 'constellation') => {
      const posMap = new Map<string, NodeCoordinate>();
      const schemes = topo.nodes.filter(n => n.labels.includes('Scheme'));
      const documents = topo.nodes.filter(n => n.labels.includes('Document'));
      const offices = topo.nodes.filter(n => n.labels.includes('Office'));
      const criteria = topo.nodes.filter(n => n.labels.includes('Criterion'));

      if (mode === 'pipeline') {
        // Hierarchical Pipeline Layout
        schemes.forEach((node, i) => {
          const step = 840 / (schemes.length + 1);
          const x = 70 + (i + 1) * step;
          const y = 110;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: i * 0.9 });
        });

        documents.forEach((node, i) => {
          const step = 920 / (documents.length + 1);
          const x = 40 + (i + 1) * step;
          const y = 290;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 4) * 0.7 });
        });

        offices.forEach((node, i) => {
          const step = 480 / (offices.length + 1);
          const x = 520 + (i + 1) * step;
          const y = 490;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 8) * 0.8 });
        });

        criteria.forEach((node, i) => {
          const step = 480 / (criteria.length + 1);
          const x = 30 + (i + 1) * step;
          const y = 490;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 12) * 0.6 });
        });
      } else {
        // Radial Constellation Layout
        const centerX = 500;
        const centerY = 300;

        // Schemes in central ring
        schemes.forEach((node, i) => {
          const angle = (i / schemes.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 130;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: i * 0.9 });
        });

        // Documents in middle ring
        documents.forEach((node, i) => {
          const angle = (i / documents.length) * 2 * Math.PI;
          const radius = 250;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 4) * 0.7 });
        });

        // Offices on the outer right arc
        offices.forEach((node, i) => {
          const angle = ((i - 1) / offices.length) * Math.PI * 0.8 - Math.PI * 0.4;
          const radius = 380;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 8) * 0.8 });
        });

        // Criteria on the outer left arc
        criteria.forEach((node, i) => {
          const angle = ((i - 2) / criteria.length) * Math.PI * 0.8 + Math.PI * 0.6;
          const radius = 370;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          posMap.set(node.id, { x, y, origX: x, origY: y, phase: (i + 12) * 0.6 });
        });
      }

      return posMap;
    },
    []
  );

  // Initialize or re-layout
  useEffect(() => {
    if (!topology) return;
    const base = computeBaseLayout(topology, layoutMode);
    setPositions(base);
  }, [topology, layoutMode, computeBaseLayout]);

  // Ambient Floating Motion Animation Loop (requestAnimationFrame)
  useEffect(() => {
    if (!floatAnimationActive) return;

    let running = true;
    const animate = () => {
      if (!running) return;
      timeRef.current += 0.02;
      const t = timeRef.current;

      setPositions(prev => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        for (const [id, coord] of next.entries()) {
          // Skip the currently dragged node
          if (id === draggedNodeId) continue;

          // Subtle organic floating harmonic oscillation
          const offsetX = Math.sin(t + coord.phase) * 3.5;
          const offsetY = Math.cos(t * 0.8 + coord.phase) * 3.5;
          next.set(id, {
            ...coord,
            x: coord.origX + offsetX,
            y: coord.origY + offsetY
          });
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [floatAnimationActive, draggedNodeId]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!topology) return [];
    return topology.nodes.filter(node => {
      const name = String(node.properties.name || node.properties.type || node.id).toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || node.labels.includes(typeFilter);
      return matchesSearch && matchesType;
    });
  }, [topology, searchQuery, typeFilter]);

  // Identify connected nodes when a node is hovered or selected
  const activeFocusNodeId = selectedNode?.id || hoveredNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!topology || !activeFocusNodeId) return null;
    const set = new Set<string>([activeFocusNodeId]);
    for (const edge of topology.edges) {
      if (edge.source === activeFocusNodeId) set.add(edge.target);
      if (edge.target === activeFocusNodeId) set.add(edge.source);
    }
    return set;
  }, [topology, activeFocusNodeId]);

  // Mouse pan handlers
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (draggedNodeId) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeId) {
      // Dragging a specific node
      const svgRect = e.currentTarget.getBoundingClientRect();
      const mouseX = (e.clientX - svgRect.left - pan.x) / zoomLevel;
      const mouseY = (e.clientY - svgRect.top - pan.y) / zoomLevel;

      setPositions(prev => {
        const next = new Map(prev);
        const current = next.get(draggedNodeId);
        if (current) {
          next.set(draggedNodeId, {
            ...current,
            x: mouseX,
            y: mouseY,
            origX: mouseX,
            origY: mouseY
          });
        }
        return next;
      });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
    }
  };

  const handleSvgMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    if (topology) {
      setPositions(computeBaseLayout(topology, layoutMode));
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-16 text-center text-xs text-slate-400">
        Loading FalkorDB Knowledge Graph topology...
      </div>
    );
  }

  if (!topology) {
    return (
      <div className="bg-slate-900/40 border border-white/[0.06] rounded-2xl p-12 text-center text-xs text-slate-400">
        Unable to load graph topology.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Welfare Knowledge Graph Visualizer</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Physics & Particle Flow</span>
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Interactive schema connecting Schemes, Prerequisite Documents, Issuing Authorities, and Conflict Edges.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-slate-900/40 border border-white/[0.06] rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
            <span>Scheme</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Document</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            <span>Office</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            <span>Criterion</span>
          </div>
          <div className="flex items-center gap-1.5 border-l border-white/[0.1] pl-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30"></span>
            <span className="text-emerald-300 font-medium">Eligible</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Modes Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 border border-white/[0.06] rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter node or scheme..."
              className="w-full bg-slate-950 border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Type filters */}
          <div className="hidden lg:flex items-center gap-1 p-0.5 bg-slate-950 border border-white/[0.08] rounded-xl text-xs">
            {(['all', 'Scheme', 'Document', 'Office', 'Criterion'] as const).map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  typeFilter === type
                    ? 'bg-white/[0.1] text-white font-semibold shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-white/[0.08] rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setLayoutMode('pipeline')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'pipeline'
                  ? 'bg-white/[0.1] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>Pipeline Flow</span>
            </button>
            <button
              onClick={() => setLayoutMode('constellation')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                layoutMode === 'constellation'
                  ? 'bg-white/[0.1] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Constellation</span>
            </button>
          </div>
        </div>

        {/* Physics & Zoom Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Floating Physics Toggle */}
          <button
            onClick={() => setFloatAnimationActive(prev => !prev)}
            className={`px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              floatAnimationActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-medium'
                : 'bg-slate-950 border-white/[0.08] text-slate-400'
            }`}
            title="Toggle Organic Floating Physics"
          >
            <Activity className={`w-3.5 h-3.5 ${floatAnimationActive ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>Physics {floatAnimationActive ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2))}
            className="p-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.5))}
            className="p-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Reset Pan & Positions"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-500 ml-1 tabular-nums">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div className="relative bg-[#070b14] border border-white/[0.06] rounded-2xl overflow-hidden h-[620px] select-none shadow-2xl">
        {/* Subtle Background Radial Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.04),transparent_70%)] pointer-events-none" />

        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <defs>
            {/* Arrow Marker Definitions */}
            <marker
              id="arrow-requires"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" opacity="0.7" />
            </marker>

            <marker
              id="arrow-eligible"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#14b8a6" opacity="0.7" />
            </marker>

            <marker
              id="arrow-office"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" opacity="0.7" />
            </marker>

            {/* Glowing Gradient Filters for Nodes */}
            <radialGradient id="grad-scheme-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="grad-eligible-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="grad-amber-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoomLevel})`}>
            {/* Background Grid Crosshairs for Spatial Depth */}
            <g opacity="0.08" stroke="#cbd5e1" strokeWidth="1">
              {[100, 300, 500, 700, 900].map(x => (
                <line key={`gx-${x}`} x1={x} y1="0" x2={x} y2="800" strokeDasharray="3 9" />
              ))}
              {[100, 300, 500].map(y => (
                <line key={`gy-${y}`} x1="0" y1={y} x2="1100" y2={y} strokeDasharray="3 9" />
              ))}
            </g>

            {/* Edges & Animated Streaming Dashes */}
            {topology.edges.map(edge => {
              const srcCoord = positions.get(edge.source);
              const tgtCoord = positions.get(edge.target);
              if (!srcCoord || !tgtCoord) return null;

              const isConflict = edge.type === 'CONFLICTS_WITH';
              const isRequires = edge.type === 'REQUIRES';
              const isEligible = edge.type === 'ELIGIBLE_IF';

              // Determine dim state if another node is focused
              const isEdgeHighlighted =
                !connectedNodeIds ||
                (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target));
              const edgeOpacity = isEdgeHighlighted ? 0.65 : 0.12;

              const strokeColor = isConflict
                ? '#f43f5e'
                : isRequires
                ? '#f59e0b'
                : isEligible
                ? '#14b8a6'
                : '#38bdf8';

              return (
                <g key={edge.id}>
                  {/* Base Connection Line */}
                  <line
                    x1={srcCoord.x}
                    y1={srcCoord.y}
                    x2={tgtCoord.x}
                    y2={tgtCoord.y}
                    stroke={strokeColor}
                    strokeWidth={isConflict ? 2.5 : 1.2}
                    opacity={edgeOpacity * 0.7}
                    markerEnd={
                      isRequires
                        ? 'url(#arrow-requires)'
                        : isEligible
                        ? 'url(#arrow-eligible)'
                        : isConflict
                        ? undefined
                        : 'url(#arrow-office)'
                    }
                  />

                  {/* Animated Particle Dash Stream flowing along connection */}
                  {isEdgeHighlighted && (
                    <line
                      x1={srcCoord.x}
                      y1={srcCoord.y}
                      x2={tgtCoord.x}
                      y2={tgtCoord.y}
                      stroke={strokeColor}
                      strokeWidth={isConflict ? 2.5 : 1.8}
                      opacity={edgeOpacity}
                      className={isConflict ? 'anim-conflict-line' : 'anim-dash-stream'}
                    />
                  )}

                  {/* Relationship Label */}
                  <text
                    x={(srcCoord.x + tgtCoord.x) / 2}
                    y={(srcCoord.y + tgtCoord.y) / 2 - 5}
                    fill={isEdgeHighlighted ? '#94a3b8' : '#475569'}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="pointer-events-none"
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map(node => {
              const coord = positions.get(node.id) || { x: 400, y: 300, origX: 400, origY: 300, phase: 0 };
              const isScheme = node.labels.includes('Scheme');
              const isDocument = node.labels.includes('Document');
              const isOffice = node.labels.includes('Office');
              const isCriterion = node.labels.includes('Criterion');

              const nodeName =
                node.properties.name ||
                `${node.properties.type} ${node.properties.operator || ''} ${node.properties.value || ''}`;

              const isEligible = eligibleSchemes.includes(node.properties.name);
              const isMissing = missingDocuments.includes(node.properties.name);
              const isHeld = heldDocuments.includes(node.properties.name);
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNodeId === node.id;

              // Dim node if focus mode is active and this node is not connected
              const isNodeDimmed = connectedNodeIds ? !connectedNodeIds.has(node.id) : false;
              const nodeOpacity = isNodeDimmed ? 0.22 : 1;

              let fillColor = '#1e1b4b'; // indigo
              let strokeColor = '#818cf8';
              let radius = 17;

              if (isScheme) {
                radius = 24;
                fillColor = '#1e1b4b';
                strokeColor = '#818cf8';
              } else if (isDocument) {
                radius = 18;
                fillColor = '#451a03';
                strokeColor = '#fbbf24';
              } else if (isOffice) {
                radius = 18;
                fillColor = '#082f49';
                strokeColor = '#38bdf8';
              } else if (isCriterion) {
                radius = 14;
                fillColor = '#042f2e';
                strokeColor = '#2dd4bf';
              }

              if (isEligible) {
                fillColor = '#064e3b';
                strokeColor = '#34d399';
              } else if (isMissing) {
                fillColor = '#78350f';
                strokeColor = '#fbbf24';
              } else if (isHeld) {
                fillColor = '#083344';
                strokeColor = '#22d3ee';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${coord.x}, ${coord.y})`}
                  opacity={nodeOpacity}
                  className="cursor-pointer transition-opacity duration-200"
                  onMouseDown={e => {
                    e.stopPropagation();
                    setDraggedNodeId(node.id);
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedNode(prev => (prev?.id === node.id ? null : node));
                  }}
                >
                  {/* Radiant Harmonic Pulsing Concentric Rings for Eligible Schemes */}
                  {isEligible && (
                    <>
                      <circle
                        r="30"
                        fill="none"
                        stroke="#34d399"
                        className="anim-ring-scheme"
                      />
                      <circle
                        r="36"
                        fill="none"
                        stroke="#10b981"
                        opacity="0.3"
                      />
                    </>
                  )}

                  {/* Radiant Beacon Ring for Top Unlock Document */}
                  {isMissing && (
                    <circle
                      r="24"
                      fill="none"
                      stroke="#fbbf24"
                      className="anim-ring-amber"
                    />
                  )}

                  {/* Selection Ring */}
                  {isSelected && (
                    <circle
                      r={radius + 7}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      opacity="0.9"
                    />
                  )}

                  {/* Hover Glow */}
                  {isHovered && !isSelected && (
                    <circle
                      r={radius + 5}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.8"
                      opacity="0.6"
                    />
                  )}

                  {/* Primary Node Circle */}
                  <circle
                    r={radius}
                    fill={fillColor}
                    stroke={isSelected ? '#ffffff' : strokeColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="transition-transform duration-150 hover:scale-110"
                  />

                  {/* Inner Node Core Symbol / Dot */}
                  <circle
                    r={isScheme ? 5 : 3}
                    fill={isSelected ? '#ffffff' : isEligible ? '#6ee7b7' : strokeColor}
                    opacity="0.85"
                  />

                  {/* Node Label Text */}
                  <text
                    y={radius + 15}
                    fill={isSelected ? '#ffffff' : '#f1f5f9'}
                    fontSize={isScheme ? '11' : '10'}
                    fontWeight={isScheme ? '700' : '500'}
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    className="pointer-events-none drop-shadow-md select-none"
                  >
                    {nodeName.length > 24 ? `${nodeName.slice(0, 22)}...` : nodeName}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Instruction Badge */}
        <div className="absolute left-4 bottom-4 text-[11px] text-slate-500 font-mono flex items-center gap-2 bg-slate-950/70 border border-white/[0.06] rounded-xl px-3 py-1.5 backdrop-blur-md">
          <span>💡 Click node to inspect details</span>
          <span aria-hidden="true">·</span>
          <span>Drag nodes to reshape graph</span>
        </div>

        {/* Node Detail Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-slate-900/90 border border-white/[0.1] backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-3 z-10 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider">
                  {selectedNode.labels.join(', ')} Node
                </span>
                <h3 className="text-sm font-bold text-white mt-0.5">
                  {selectedNode.properties.name || selectedNode.properties.type || selectedNode.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.08]">
              {Object.entries(selectedNode.properties).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-2">
                  <span className="text-slate-400 font-mono">{key}:</span>
                  <span className="text-slate-200 text-right font-medium">
                    {typeof val === 'string' && val.startsWith('http') ? (
                      <a
                        href={val}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>Portal URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      String(val)
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
              <span>Status:</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {eligibleSchemes.includes(selectedNode.properties.name)
                  ? 'Eligible Scheme'
                  : missingDocuments.includes(selectedNode.properties.name)
                  ? 'Missing Unlock Document'
                  : heldDocuments.includes(selectedNode.properties.name)
                  ? 'Held by Citizen'
                  : 'Graph Entity'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
