'use client';

import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
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
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

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
  allChildren?: string[]; // For admin: all children (unlimited)
  leftBusiness: string;
  rightBusiness: string;
  leftCarry: string;
  rightCarry: string;
  leftDownlines: number;
  rightDownlines: number;
}

interface TreeData {
  tree: TreeUser[];
  statistics: {
    totalUsers: number;
    activeUsers: number;
    totalDownlines: number;
  };
}

interface CustomNodeData {
  user: TreeUser;
  isRoot: boolean;
  onHover: (user: TreeUser | null) => void;
}

// Custom Node Component with hover popup - Memoized for performance
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

  // Check if this is admin node (not a binary node)
  const isAdmin = user.userId === "CROWN-000000";
  const totalChildren = isAdmin ? (user.allChildren?.length || user.leftDownlines || 0) : null;

  return (
    <div
      className={`custom-node ${isRoot ? 'root-node' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', zIndex: showPopup ? 99998 : 'auto' }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-content">
        <div className="node-header">{user.name || 'Unknown'}</div>
        <div className="node-userid">{user.userId || 'N/A'}</div>
        <div className="node-status">{user.status}</div>
        <div className="node-business">
          {isAdmin ? (
            // Admin: show total children (not binary)
            <div className="business-total" style={{ width: '100%', textAlign: 'center' }}>
              <span className="business-label">Children</span>
              <span className="business-value">{totalChildren}</span>
            </div>
          ) : (
            // Non-admin: show L/R with business amounts and downlines
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
      </div>
      <Handle type="source" position={Position.Bottom} />
      {showPopup && (
        <div className="node-popup" style={{ zIndex: 99999, pointerEvents: 'none' }}>
          <div className="popup-header">User Details</div>
          <div className="popup-content">
            <div className="popup-item">
              <strong>Name:</strong> {user.name || 'Unknown'}
            </div>
            <div className="popup-item">
              <strong>User ID:</strong> {user.userId || 'N/A'}
            </div>
            <div className="popup-item">
              <strong>Email:</strong> {user.email || 'No email'}
            </div>
            <div className="popup-item">
              <strong>Phone:</strong> {user.phone || 'No phone'}
            </div>
            <div className="popup-item">
              <strong>Status:</strong> {user.status}
            </div>
            {user.parentName && (
              <div className="popup-section">
                <div className="popup-section-title">Parent</div>
                <div className="popup-item">
                  <strong>Name:</strong> {user.parentName}
                </div>
                <div className="popup-item">
                  <strong>User ID:</strong> {user.parentUserId || 'N/A'}
                </div>
              </div>
            )}
            <div className="popup-section">
              <div className="popup-section-title">Business</div>
              {isAdmin ? (
                <>
                  <div className="popup-item">
                    <strong>Total Children:</strong> {totalChildren || 0}
                  </div>
                  <div className="popup-item">
                    <strong>Note:</strong> Admin node can have unlimited children (not binary)
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
                </>
              )}
            </div>
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

export default function TreePage() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredUser, setHoveredUser] = useState<TreeUser | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [maxDepth, setMaxDepth] = useState<number>(5); // Limit initial depth for performance
  const [showAllNodes, setShowAllNodes] = useState(true); // Show all nodes by default
  const [searchTerm, setSearchTerm] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Fetch tree data
  useEffect(() => {
    const fetchTreeData = async () => {
      try {
        setLoading(true);
        // Use same default as API client: local backend in development,
        // overrideable via NEXT_PUBLIC_API_URL in staging/production.
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
        const response = await fetch(`${apiUrl}/tree/view`);
        if (!response.ok) {
          throw new Error('Failed to fetch tree data');
        }
        const data = await response.json();
        setTreeData(data.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load tree data');
      } finally {
        setLoading(false);
      }
    };

    fetchTreeData();
  }, []);

  // Build optimized tree map for O(1) lookups
  const treeMap = useMemo(() => {
    if (!treeData || !treeData.tree) return new Map<string, TreeUser>();
    const map = new Map<string, TreeUser>();
    treeData.tree.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [treeData]);

  // Build React Flow nodes and edges from tree data - Optimized with memoization
  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    if (!treeData || !treeData.tree || treeMap.size === 0) {
      return { nodes: [], edges: [] };
    }

    const tree = treeData.tree;
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];

    // Find root node - O(1) lookup if we had index, but O(n) is acceptable for root
    const root = tree.find((u) => !u.parent || u.parent === null);
    if (!root) return { nodes: [], edges: [] };

    // Build tree structure and calculate positions
    const nodePositions = new Map<string, { x: number; y: number }>();
    const levels: TreeUser[][] = [];
    const processed = new Set<string>();

    // Build a map of parent -> children for efficient lookup
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
      
      // Limit depth for performance if not showing all nodes
      if (!showAllNodes && level > maxDepth) return;

      if (!levels[level]) levels[level] = [];
      levels[level].push(user);
      processed.add(user.id);

      // Get all children of this user
      const isAdmin = user.userId === "CROWN-000000";
      
      const childrenSet = new Set<TreeUser>();
      
      if (isAdmin) {
        // Admin can have unlimited children - get all from parent relationship
        const allChildren = childrenMap.get(user.id) || [];
        allChildren.forEach(child => {
          if (child) childrenSet.add(child);
        });
      } else {
        // For non-admin: use binary tree rules (left/right only)
        const leftChild = user.leftChild ? treeMap.get(user.leftChild) : null;
        const rightChild = user.rightChild ? treeMap.get(user.rightChild) : null;
        
        if (leftChild) childrenSet.add(leftChild);
        if (rightChild) childrenSet.add(rightChild);
        
        // Also check parent relationship for compatibility
        const allChildren = childrenMap.get(user.id) || [];
        allChildren.forEach(child => {
          if (child) childrenSet.add(child);
        });
      }

      // Add all children to next level
      childrenSet.forEach(child => {
        if (child && !processed.has(child.id)) {
          addToLevel(child, level + 1);
        }
      });
    };

    addToLevel(root, 0);

    // Ensure all nodes are included (fallback for disconnected nodes)
    if (showAllNodes) {
      tree.forEach((user) => {
        if (!processed.has(user.id)) {
          // Find the level by traversing up to root
          let level = 0;
          let currentUser: TreeUser | undefined = user;
          while (currentUser?.parent) {
            level++;
            currentUser = treeMap.get(currentUser.parent);
            if (!currentUser || level > 20) break; // Safety limit
          }
          
          if (!levels[level]) levels[level] = [];
          levels[level].push(user);
          processed.add(user.id);
        }
      });
    }

    // Calculate positions for binary tree layout - optimized for large trees
    const maxWidth = 8000; // Increased for large screens
    const horizontalSpacing = 400; // Increased x-coordinate spacing
    const verticalSpacing = 300; // Increased y-coordinate spacing

    levels.forEach((levelUsers, levelIndex) => {
      // Calculate actual level width based on number of nodes (not just binary tree assumption)
      const levelWidth = levelUsers.length;
      const startX = (maxWidth - (levelWidth - 1) * horizontalSpacing) / 2;

      levelUsers.forEach((user, index) => {
        const x = startX + index * horizontalSpacing;
        const y = levelIndex * verticalSpacing + 150;
        nodePositions.set(user.id, { x, y });
      });
    });

    // Create nodes
    levels.forEach((levelUsers, levelIndex) => {
      levelUsers.forEach((user) => {
        const isRoot = levelIndex === 0;
        const position = nodePositions.get(user.id) || { x: 0, y: 0 };
        
        // For admin, calculate total children count
        const isAdmin = user.userId === "CROWN-000000";
        let userWithChildren = { ...user };
        if (isAdmin) {
          const adminChildren = childrenMap.get(user.id) || [];
          userWithChildren.allChildren = adminChildren.map(c => c.id);
        }

        const node: Node = {
          id: user.id,
          type: 'custom',
          position,
          data: {
            user: userWithChildren,
            isRoot,
            onHover: setHoveredUser,
          },
        };

        nodeMap.set(user.id, node);

        // Create edges to children
        let userChildren: TreeUser[] = [];
        
        if (isAdmin) {
          // Admin: get all children from parent relationship
          userChildren = childrenMap.get(user.id) || [];
        } else {
          // Non-admin: use binary tree (left/right only)
          if (user.leftChild) {
            const leftChildUser = treeMap.get(user.leftChild);
            if (leftChildUser) userChildren.push(leftChildUser);
          }
          if (user.rightChild) {
            const rightChildUser = treeMap.get(user.rightChild);
            if (rightChildUser) userChildren.push(rightChildUser);
          }
        }

        // Create edges for all children
        userChildren.forEach((child) => {
          const isLeft = child.id === user.leftChild;
          const isRight = child.id === user.rightChild;
          
          edgeList.push({
            id: `${user.id}-${child.id}`,
            source: user.id,
            target: child.id,
            type: 'smoothstep',
            style: { 
              stroke: isAdmin ? '#f5576c' : (isLeft ? '#667eea' : isRight ? '#764ba2' : '#9ca3af'), 
              strokeWidth: isAdmin ? 4 : 3 
            }, 
            label: isAdmin ? '' : (isLeft ? 'L' : isRight ? 'R' : ''),
            labelStyle: { 
              fill: isAdmin ? '#f5576c' : (isLeft ? '#667eea' : isRight ? '#764ba2' : '#9ca3af'), 
              fontWeight: 600 
            },
          });
        });
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: edgeList,
    };
  }, [treeData, treeMap, maxDepth, showAllNodes]);

  // Update nodes and edges when computed values change
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  // Handle search functionality
  const handleSearch = useCallback((searchValue: string) => {
    if (!searchValue.trim() || !treeData || !treeMap) {
      setSearchError(null);
      setHighlightedNodeId(null);
      return;
    }

    const searchLower = searchValue.trim().toLowerCase();
    let foundUser: TreeUser | null = null;

    // Search by userId (exact or partial match)
    for (const user of treeData.tree) {
      if (user.userId?.toLowerCase().includes(searchLower) || 
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)) {
        foundUser = user;
        break;
      }
    }

    if (foundUser) {
      setSearchError(null);
      setHighlightedNodeId(foundUser.id);
      
      // Find the node and navigate to it
      const targetNode = computedNodes.find(n => n.id === foundUser!.id);
      if (targetNode && reactFlowInstance.current) {
        const { x, y } = targetNode.position;
        reactFlowInstance.current.setCenter(x, y, { zoom: 1.2, duration: 800 });
      }
    } else {
      setSearchError(`User "${searchValue}" not found in tree`);
      setHighlightedNodeId(null);
    }
  }, [treeData, treeMap, computedNodes]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading tree data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <ProtectedRoute requireUser>
      <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700">
      {/* Header - Compact */}
      <div className="bg-white shadow-lg p-2 z-10">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold text-gray-800">Binary Tree</h1>
          {/* Statistics - Compact Horizontal */}
          {treeData?.statistics && (
            <div className="flex gap-4 items-center">
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">{treeData.statistics.totalUsers}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{treeData.statistics.activeUsers}</div>
                <div className="text-xs text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{treeData.statistics.totalDownlines}</div>
                <div className="text-xs text-gray-600">Downlines</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{nodes.length}</div>
                <div className="text-xs text-gray-600">Rendered</div>
              </div>
            </div>
          )}
        </div>
        {/* Controls and Search - Compact Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Performance Controls */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showAllNodes}
                onChange={(e) => setShowAllNodes(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-700">Show All ({treeData?.statistics.totalUsers || 0})</span>
            </label>
            {!showAllNodes && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-700">Depth:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))}
                  className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                />
              </div>
            )}
          </div>
          {/* Search Bar - Compact */}
          <div className="flex gap-1.5 items-center flex-1 min-w-[300px] max-w-md">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchTerm);
                  }
                }}
                placeholder="Search by User ID, Name, or Email..."
                className="w-full px-3 py-1.5 pl-8 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <svg
                className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={() => handleSearch(searchTerm)}
              className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Search
            </button>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSearchError(null);
                  setHighlightedNodeId(null);
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {searchError && (
          <div className="text-red-600 text-xs bg-red-50 p-1.5 rounded mt-1.5">
            {searchError}
          </div>
        )}
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1" style={{ position: 'relative', overflow: 'visible', zIndex: 1 }}>
        <ReactFlow
          nodes={nodes.map(node => ({
            ...node,
            style: {
              ...node.style,
              border: highlightedNodeId === node.id ? '4px solid #fbbf24' : undefined,
              boxShadow: highlightedNodeId === node.id ? '0 0 20px rgba(251, 191, 36, 0.8)' : undefined,
            },
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={onInit}
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
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.data?.isRoot) return '#f5576c';
              return '#667eea';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            pannable={true}
            zoomable={true}
          />
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
          z-index: 100;
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

        .node-content {
          text-align: center;
          display: block;
        }

        .custom-node:hover .node-content {
          display: block;
        }

        .node-header {
          font-weight: bold;
          font-size: 1.2em;
          margin-bottom: 8px;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .root-node .node-header {
          color: white;
          font-size: 1.4em;
        }

        .node-userid {
          font-size: 1em;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 700;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .root-node .node-userid {
          color: white;
          font-size: 1.1em;
        }

        .node-status {
          font-size: 0.9em;
          color: white;
          margin-bottom: 10px;
          padding: 6px 12px;
          border-radius: 8px;
          display: inline-block;
          background: rgba(255, 255, 255, 0.25);
          font-weight: 600;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .root-node .node-status {
          background: rgba(255, 255, 255, 0.35);
          color: white;
        }

        .node-business {
          display: flex;
          justify-content: space-around;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid rgba(255, 255, 255, 0.3);
        }

        .root-node .node-business {
          border-top-color: rgba(255, 255, 255, 0.4);
        }

        .business-left,
        .business-right {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          min-width: 50px;
        }

        .business-label {
          font-size: 0.7em;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 4px;
          font-weight: 600;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .root-node .business-label {
          color: rgba(255, 255, 255, 0.95);
        }

        .business-value {
          font-weight: bold;
          font-size: 1.3em;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .root-node .business-value {
          color: white;
          font-size: 1.5em;
        }

        .business-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .business-amount {
          font-weight: bold;
          font-size: 1.1em;
          color: white;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .business-downlines {
          font-size: 0.75em;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .node-popup {
          position: absolute;
          top: 50%;
          left: calc(100% + 16px);
          transform: translateY(-50%);
          background: white;
          border: 3px solid #667eea;
          border-radius: 8px;
          padding: 12px;
          min-width: 250px;
          max-width: 300px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          z-index: 99999 !important;
          pointer-events: none;
          font-size: 0.8em;
          white-space: normal;
          isolation: isolate;
        }

        .node-popup::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 8px solid transparent;
          border-right-color: #667eea;
          z-index: 99999;
        }
        .custom-node.root-node .node-popup {
          border-color: #f5576c;
        }
        .custom-node.root-node .node-popup::before {
          border-right-color: #f5576c;
        }
        .react-flow__node {
          z-index: 1 !important;
        }
        .react-flow__node:hover {
          z-index: 100 !important;
        }
        .react-flow__node .node-popup {
          z-index: 99999 !important;
        }

        .popup-header {
          font-weight: bold;
          font-size: 0.9em;
          margin-bottom: 6px;
          color: #667eea;
          border-bottom: 1px solid #eee;
          padding-bottom: 3px;
        }

        .popup-content {
          font-size: 0.85em;
        }

        .popup-item {
          margin: 4px 0;
          color: #333;
          white-space: normal;
          word-wrap: break-word;
        }

        .popup-section {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }

        .popup-section-title {
          font-weight: bold;
          color: #667eea;
          margin-bottom: 4px;
          font-size: 0.8em;
        }

        .react-flow__node {
          cursor: move;
        }

        .react-flow__node.selected {
          box-shadow: 0 0 0 2px #667eea;
        }

        .react-flow__handle {
          width: 12px;
          height: 12px;
          background: rgba(255, 255, 255, 0.8);
          border: 2px solid #667eea;
          border-radius: 50%;
        }

        .custom-node:hover .react-flow__handle {
          background: white;
          border-color: #764ba2;
          width: 14px;
          height: 14px;
        }

        .root-node .react-flow__handle {
          background: rgba(255, 255, 255, 0.9);
          border-color: #f5576c;
        }
      `}</style>
      </div>
    </ProtectedRoute>
  );
}
