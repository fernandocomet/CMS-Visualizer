import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Background, Controls, Handle, Position, useNodesState, useEdgesState, getNodesBounds, getViewportForBounds } from 'reactflow';
import axios from 'axios';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';

// 1. Nodo personalizado definido fuera para evitar re-renders innecesarios
const CollectionNode = ({ data }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.08)', minWidth: '240px' }}>
    <div style={{ background: '#6366f1', color: 'white', padding: '12px 16px', fontWeight: 'bold', fontSize: '14px' }}>
      {data.label}
    </div>
    <div style={{ padding: '10px' }}>
      {data.fields?.map((f, i) => (
        <div key={i} style={{ fontSize: '12px', padding: '6px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{f.displayName}</span>
          <span style={{ color: '#000000', fontSize: '9px', background: '#e0e7ff', padding: '2px 5px', borderRadius: '4px' }}>{f.type}</span>
        </div>
      ))}
    </div>
    <Handle type="target" position={Position.Left} style={{ background: '#6366f1' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#6366f1' }} />
  </div>
);

const nodeTypes = { collection: CollectionNode };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  // null = todavía no lo sabemos (chequeando), true/false = estado real de la conexión OAuth
  const [connected, setConnected] = useState(null);

  const fetchWebflowData = useCallback(async () => {
    setLoading(true);

    try {
      setProgress("Loading collections...");
      const res = await axios.get('/api/collections', { withCredentials: true });

      const basicCollections = res.data.collections || [];
      const fullCollections = [];

      // Carga secuencial para evitar el error 429
      for (let i = 0; i < basicCollections.length; i++) {
        const col = basicCollections[i];
        setProgress(`Loading: ${col.displayName} (${i + 1}/${basicCollections.length})`);

        const detailRes = await axios.get(`/api/collections/${col.id}`, { withCredentials: true });

        fullCollections.push(detailRes.data);
        await sleep(400); // Pausa de seguridad
      }
      setConnected(true);

      const fieldPriority = (f) => (f.slug === 'name' ? 0 : f.slug === 'slug' ? 1 : 2);
      const newNodes = fullCollections.map((col, index) => ({
        id: col.id,
        type: 'collection',
        position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 450 },
        data: { label: col.displayName, fields: [...(col.fields || [])].sort((a, b) => fieldPriority(a) - fieldPriority(b)) }
      }));

      const newEdges = [];
      fullCollections.forEach(col => {
        col.fields?.forEach(field => {
          const targetColId = field.validations?.collectionId;
          if (targetColId) {
            newEdges.push({
              id: `e-${col.id}-${targetColId}`,
              source: col.id,
              target: targetColId,
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            });
          }
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
      setProgress("");
    } catch (error) {
      console.error(error);
      const status = error.response?.status;
      if (status === 401) {
        // Sesión no conectada o token revocado: mostramos el botón de conectar, sin alertas.
        setConnected(false);
      } else {
        const data = error.response?.data;
        const msg = (typeof data === 'string' ? data : data?.message || data?.msg || data?.error) || error.message;
        let userMsg = "Connection error.";
        if (!error.response) userMsg = "Network error. Is the server running?";
        else if (status === 429) userMsg = "Rate limit reached. Wait 1 minute.";
        else if (msg) userMsg += ` ${msg}`;
        alert(userMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  const onConnect = () => {
    window.location.href = '/api/auth/start';
  };

  const onDisconnect = async () => {
    try {
      await axios.post('/api/auth/disconnect', {}, { withCredentials: true });
    } finally {
      setConnected(false);
      setNodes([]);
      setEdges([]);
    }
  };

  // FUNCIÓN PARA CAPTURAR IMAGEN: encuadra todo el grafo, no solo el viewport actual
  const onDownload = () => {
    const el = document.querySelector('.react-flow__viewport');
    if (!el || nodes.length === 0) return;

    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = Math.round(nodesBounds.width + 100);
    const imageHeight = Math.round(nodesBounds.height + 100);
    const viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.1, 2);

    toPng(el, {
      backgroundColor: '#F8FAFC',
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `cms-map-${new Date().toLocaleDateString()}.png`;
      link.href = dataUrl;
      link.click();
    });
  };

  useEffect(() => { fetchWebflowData(); }, [fetchWebflowData]);

  if (connected === false) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={onConnect} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '16px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
          🔗 Connect your Webflow site
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F8FAFC' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '10px' }}>
        <button onClick={fetchWebflowData} disabled={loading} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
          {loading ? progress : '🔄 Sync'}
        </button>
        <button onClick={onDownload} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
          📸 Download PNG
        </button>
        <button onClick={onDisconnect} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
          ⛔ Disconnect
        </button>
      </div>

      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} fitView>
        <Background variant="dots" gap={30} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  );
}