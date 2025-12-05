'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '@/lib/api';

interface TreeUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  parent: string | null;
  parentUserId: string | null;
  parentName: string | null;
  leftChild: string | null;
  rightChild: string | null;
  allChildren?: string[];
  leftBusiness: string;
  rightBusiness: string;
  leftCarry: string;
  rightCarry: string;
  leftDownlines: number;
  rightDownlines: number;
  level: number;
  totalInvestment?: string;
}

interface TreeData {
  tree: TreeUser[];
  rootUserId: string;
  rootName: string;
}

interface CustomNodeData {
  user: TreeUser;
  isRoot: boolean;
  onHover: (user: TreeUser | null) => void;
}

const CustomNode = memo(({ data }: { data: CustomNodeData }) => {
  const { user, isRoot, onHover } = data;
  const [showPopup, setShowPopup] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShowPopup(true);
    onHover(user);
  }, [user, onHover]);

  const handleMouseLeave = useCallback(() => {
    setShowPopup(false);
    onHover(null);
  }, [onHover]);

  const isAdmin = user.userId === "CROWN-000000";
  const totalChildren = isAdmin ? (user.allChildren?.length || user.leftDownlines || 0) : null;

  return (
    <div
      className={`custom-node ${isRoot ? 'root-node' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-header">{user.name || 'Unknown'}</div>
        <div className="node-userid">{user.userId || 'N/A'}</div>
        <div className="node-status">{user.status}</div>
        <div className="node-business">
          {isAdmin ? (
            <div className="business-total" style={{ width: '100%', textAlign: 'center' }}>
              <span className="business-label">Children</span>
              <span className="business-value">{totalChildren}</span>
            </div>
          ) : (
            <>
              <div className="business-left">
                <span className="business-label">L</span>
                <div className="business-details">
                  <span className="business-amount">${parseFloat(user.leftBusiness || '0').toFixed(0)}</span>
                  <span className="business-downlines">({user.leftDownlines})</span>
                </div>
              </div>
              <div className="business-right">
                <span className="business-label">R</span>
                <div className="business-details">
                  <span className="business-amount">${parseFloat(user.rightBusiness || '0').toFixed(0)}</span>
                  <span className="business-downlines">({user.rightDownlines})</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="node-investment">
          <span className="investment-label">Total Investment</span>
          <span className="investment-value">
            ${parseFloat(user.totalInvestment || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
      {showPopup && (
        <div className="node-popup" style={{ zIndex: 10000, pointerEvents: 'none' }}>
          <div className="popup-header">User Details</div>
          <div className="popup-content">
            <div className="popup-item">
              <strong>Name:</strong> {user.name || 'Unknown'}
            </div>
            <div className="popup-item">
              <strong>User ID:</strong> {user.userId || 'N/A'}
            </div>
            <div className="popup-item">
              <strong>Status:</strong> {user.status}
            </div>
            {isAdmin ? (
              <>
                <div className="popup-item">
                  <strong>Total Children:</strong> {totalChildren || 0}
                </div>
                <div className="popup-item" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <strong>Total Investment:</strong> ${parseFloat(user.totalInvestment || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </>
            ) : (
              <>
                <div className="popup-item">
                  <strong>Left Business:</strong> ${parseFloat(user.leftBusiness || '0').toFixed(2)}
                </div>
                <div className="popup-item">
                  <strong>Right Business:</strong> ${parseFloat(user.rightBusiness || '0').toFixed(2)}
                </div>
                <div className="popup-item">
                  <strong>Left Carry Forward:</strong> ${parseFloat(user.leftCarry || '0').toFixed(2)}
                </div>
                <div className="popup-item">
                  <strong>Right Carry Forward:</strong> ${parseFloat(user.rightCarry || '0').toFixed(2)}
                </div>
                <div className="popup-item">
                  <strong>Left Downlines:</strong> {user.leftDownlines || 0}
                </div>
                <div className="popup-item">
                  <strong>Right Downlines:</strong> {user.rightDownlines || 0}
                </div>
                <div className="popup-item" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <strong>Total Investment:</strong> ${parseFloat(user.totalInvestment || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

export default function MyTreePage() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredUser, setHoveredUser] = useState<TreeUser | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [showAllNodes, setShowAllNodes] = useState(true);

  useEffect(() => {
    const fetchTreeData = async () => {
      try {
        setLoading(true);
        const response = await api.getMyTree();
        if (response.data) {
          setTreeData(response.data);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load tree data');
      } finally {
        setLoading(false);
      }
    };

    fetchTreeData();
  }, []);

  const treeMap = useMemo(() => {
    const map = new Map<string, TreeUser>();
    if (treeData?.tree) {
      treeData.tree.forEach((user) => {
        map.set(user.id, user);
      });
    }
    return map;
  }, [treeData]);

  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    if (!treeData || !treeData.tree || treeMap.size === 0) {
      return { nodes: [], edges: [] };
    }

    const tree = treeData.tree;
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];

    // Find root node (user's own node)
    const root = tree.find((u) => u.userId === treeData.rootUserId);
    if (!root) return { nodes: [], edges: [] };

    const nodePositions = new Map<string, { x: number; y: number }>();
    const levels: TreeUser[][] = [];
    const processed = new Set<string>();

    const childrenMap = new Map<string, TreeUser[]>();
    tree.forEach((user) => {
      if (user.parent) {
        if (!childrenMap.has(user.parent)) {
          childrenMap.set(user.parent, []);
        }
        childrenMap.get(user.parent)!.push(user);
      }
    });

    const addToLevel = (user: TreeUser, level: number) => {
      if (!user || processed.has(user.id)) return;
      if (!showAllNodes && level > maxDepth) return;

      if (!levels[level]) levels[level] = [];
      levels[level].push(user);
      processed.add(user.id);

      const isAdmin = user.userId === "CROWN-000000";
      const childrenSet = new Set<TreeUser>();
      
      if (isAdmin) {
        const allChildren = childrenMap.get(user.id) || [];
        allChildren.forEach(child => {
          if (child) childrenSet.add(child);
        });
      } else {
        const leftChild = user.leftChild ? treeMap.get(user.leftChild) : null;
        const rightChild = user.rightChild ? treeMap.get(user.rightChild) : null;
        
        if (leftChild) childrenSet.add(leftChild);
        if (rightChild) childrenSet.add(rightChild);
        
        const allChildren = childrenMap.get(user.id) || [];
        allChildren.forEach(child => {
          if (child) childrenSet.add(child);
        });
      }

      childrenSet.forEach(child => {
        if (child && !processed.has(child.id)) {
          addToLevel(child, level + 1);
        }
      });
    };

    addToLevel(root, 0);

    if (showAllNodes) {
      tree.forEach((user) => {
        if (!processed.has(user.id)) {
          let level = user.level || 0;
          if (!levels[level]) levels[level] = [];
          levels[level].push(user);
          processed.add(user.id);
        }
      });
    }

    const maxWidth = 8000;
    const horizontalSpacing = 400;
    const verticalSpacing = 300;

    levels.forEach((levelUsers, levelIndex) => {
      const levelWidth = levelUsers.length;
      const startX = (maxWidth - (levelWidth - 1) * horizontalSpacing) / 2;

      levelUsers.forEach((user, index) => {
        const x = startX + index * horizontalSpacing;
        const y = levelIndex * verticalSpacing + 150;
        nodePositions.set(user.id, { x, y });
      });
    });

    levels.forEach((levelUsers) => {
      levelUsers.forEach((user) => {
        const isRoot = user.id === root.id;
        const position = nodePositions.get(user.id) || { x: 0, y: 0 };

        const node: Node = {
          id: user.id,
          type: 'custom',
          position,
          data: {
            user,
            isRoot,
            onHover: setHoveredUser,
          },
        };
        nodeMap.set(user.id, node);

        const userChildren = childrenMap.get(user.id) || [];
        if (user.leftChild) {
          const leftChildUser = treeMap.get(user.leftChild);
          if (leftChildUser && !userChildren.find(c => c.id === user.leftChild)) {
            userChildren.push(leftChildUser);
          }
        }
        if (user.rightChild) {
          const rightChildUser = treeMap.get(user.rightChild);
          if (rightChildUser && !userChildren.find(c => c.id === user.rightChild)) {
            userChildren.push(rightChildUser);
          }
        }

        userChildren.forEach((child) => {
          const isLeft = child.id === user.leftChild;
          const isRight = child.id === user.rightChild;
          
          edgeList.push({
            id: `${user.id}-${child.id}`,
            source: user.id,
            target: child.id,
            type: 'smoothstep',
            style: { 
              stroke: isLeft ? '#667eea' : isRight ? '#764ba2' : '#9ca3af', 
              strokeWidth: 3 
            },
            label: isLeft ? 'L' : isRight ? 'R' : '',
            labelStyle: { 
              fill: isLeft ? '#667eea' : isRight ? '#764ba2' : '#9ca3af', 
              fontWeight: 600 
            },
          });
        });
      });
    });
    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [treeData, treeMap, maxDepth, showAllNodes]);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-xl">Loading tree data...</div>
        </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
          <div className="text-xl text-red-500">Error: {error}</div>
        </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] flex flex-col bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 rounded-lg overflow-hidden">
        <div className="bg-white shadow-lg p-4 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-center text-gray-800">My Genealogy</h1>
              {treeData && (
                <p className="text-center text-gray-600 mt-1">
                  Root: {treeData.rootName} ({treeData.rootUserId}) - {treeData.tree.length} total nodes
                </p>
              )}
            </div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              ← Back
            </button>
          </div>
        </div>
        <div className="flex-1" style={{ position: 'relative', overflow: 'visible' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            selectNodesOnDrag={true}
            onlyRenderVisibleElements={true}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <style jsx global>{`
          .custom-node {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: 4px solid #667eea;
            border-radius: 16px;
            padding: 18px 24px;
            min-width: 280px;
            max-width: 320px;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            position: relative;
            font-size: 14px;
            color: white;
            cursor: move;
          }
          .custom-node:hover {
            transform: scale(1.15);
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5);
            border-color: #764ba2;
            z-index: 10;
          }
          .custom-node.root-node {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-color: #f5576c;
            color: white;
            min-width: 320px;
            max-width: 360px;
            box-shadow: 0 8px 24px rgba(245, 87, 108, 0.5);
          }
          .custom-node.root-node:hover {
            box-shadow: 0 10px 30px rgba(245, 87, 108, 0.6);
          }
          .node-popup {
            position: absolute;
            bottom: calc(100% + 12px);
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border: 3px solid #667eea;
            border-radius: 8px;
            padding: 12px;
            min-width: 250px;
            max-width: 300px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
            z-index: 10000 !important;
            pointer-events: none !important;
            font-size: 0.8em;
            white-space: normal;
            color: #333;
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
          }
          .popup-header {
            font-weight: bold;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
            color: #667eea;
          }
          .popup-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .popup-item {
            font-size: 0.85em;
            color: #374151;
          }
          .node-header {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 6px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }
          .node-userid {
            font-size: 0.85em;
            opacity: 0.9;
            margin-bottom: 8px;
          }
          .node-status {
            font-size: 0.8em;
            padding: 4px 8px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.2);
            display: inline-block;
            margin-bottom: 10px;
          }
          .node-business {
            display: flex;
            justify-content: space-around;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
          }
          .business-left,
          .business-right {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            min-width: 60px;
          }
          .business-label {
            font-size: 0.75em;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 4px;
            font-weight: 600;
          }
          .business-details {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
          }
          .business-amount {
            font-weight: bold;
            font-size: 1em;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
          }
          .business-downlines {
            font-size: 0.7em;
            color: rgba(255, 255, 255, 0.85);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          }
          .business-value {
            font-weight: bold;
            font-size: 1.2em;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
          }
          .business-total {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .node-investment {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
          }
          .investment-label {
            font-size: 0.75em;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 600;
          }
          .investment-value {
            font-weight: bold;
            font-size: 1em;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
          }
          .node-content {
            pointer-events: none;
          }
        `}</style>
      </div>
  );
}

