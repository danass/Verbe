import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { db } from '../database';
import { ZoomIn, ZoomOut, RefreshCw, Calendar, Trash2, Eye, EyeOff } from 'lucide-react';
import { TimeType, Frequency, Relation, Instance } from '../types';
import { notify } from '../utils/toast';

// Interface pour les données de simulation D3
interface EntityNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  hidden?: boolean;
  isJunction?: boolean;
}

interface EntityLink {
  source: string | EntityNode;
  target: string | EntityNode;
  value: number;
  label: string;
  relationId: number;
  timeType?: TimeType;
  frequency?: Frequency;
  customTime?: string;
}

// Add new interfaces for managing hidden relations
interface RelationVisibility {
  relationId: number;
  isHidden: boolean;
}

interface RelationWithDetails {
  id: number;
  subject: string;
  verb: string;
  object: string;
  subjectInstance?: Instance;
  objectInstance?: Instance;
  timestamp: string;
  timeType?: string;
  frequency?: string;
  customTime?: string;
}

const EntityTree: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const zoomHandlerRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  // Time edit modal states
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState<any | null>(null);
  const [timeType, setTimeType] = useState<TimeType>('specific');
  const [frequency, setFrequency] = useState<Frequency>('occasionally');
  const [customTime, setCustomTime] = useState('');

  // Entity context menu states
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set());

  // Add new state for managing relations visibility
  const [hiddenRelations, setHiddenRelations] = useState<Set<number>>(new Set());
  const [selectedEntityRelations, setSelectedEntityRelations] = useState<RelationWithDetails[]>([]);

  // Add state to store node positions
  const nodePositionsRef = useRef<Map<string, { x: number, y: number }>>(new Map());

  // Add to state:
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Add these state variables near the other state declarations
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const [eventStats, setEventStats] = useState<{verb: string, count: number}[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [sourceEntity, setSourceEntity] = useState<string | null>(null);
  const [newRelationVerb, setNewRelationVerb] = useState('');

  // Add these state variables and refs after the other state declarations (around line 47)
  const [showRelationStats, setShowRelationStats] = useState(true);
  const [relationStats, setRelationStats] = useState<{relation: string, count: number}[]>([]);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  const handleZoomIn = () => {
    if (svgRef.current && zoomHandlerRef.current) {
      const zoom = zoomHandlerRef.current;
      d3.select(svgRef.current).transition().duration(300).call(
        zoom.scaleBy, 1.3
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomHandlerRef.current) {
      const zoom = zoomHandlerRef.current;
      d3.select(svgRef.current).transition().duration(300).call(
        zoom.scaleBy, 0.7
      );
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomHandlerRef.current) {
      const zoom = zoomHandlerRef.current;
      d3.select(svgRef.current).transition().duration(500).call(
        zoom.transform, d3.zoomIdentity
      );
      setZoomLevel(1);
    }
  };
  
  const handleEditTime = (relation: any) => {
    setSelectedRelation(relation);
    // Set defaults or load existing values
    setTimeType(relation.timeType || 'specific');
    setFrequency(relation.frequency || 'occasionally');
    setCustomTime(relation.customTime || '');
    setShowTimeModal(true);
  };

  const handleSaveTime = () => {
    if (!selectedRelation) return;
    
    try {
      // Create an updates object with temporal information
      const timeUpdates = {
        timeType,
        ...(timeType === 'recurring' ? { frequency } : {}),
        ...(timeType === 'specific' && customTime ? { customTime } : {})
      };
      
      // Update the relation in the database
      const success = db.updateRelationTime(selectedRelation.relationId, timeUpdates);
      
      if (success) {
        notify.success('Time information updated successfully');
        setShowTimeModal(false);
        // Redraw the graph to reflect changes
        renderGraph();
      } else {
        notify.error('Failed to update time information');
      }
    } catch (error) {
      console.error('Error updating time:', error);
      notify.error('An error occurred while updating time information');
    }
  };

  const handleNodeClick = (event: MouseEvent, entity: EntityNode) => {
    event.preventDefault();
    // Always fetch the latest relations for this entity
    const relations = db.getRelationsWithDetails().filter(r => 
      r.subject === entity.name || r.object === entity.name
    );
    setSelectedEntityRelations(relations);
    setSelectedEntity(entity.name);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setShowContextMenu(true);
  };

  const handleToggleRelation = (relationId: number) => {
    setHiddenRelations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(relationId)) {
        newSet.delete(relationId);
      } else {
        newSet.add(relationId);
      }
      // Update D3 link visibility
      d3.select(svgRef.current)
        .selectAll('.links path')
        .each(function(d: any) {
          if (d.relationId === relationId) {
            d3.select(this).style('display', newSet.has(relationId) ? 'none' : '');
          }
        });
      return newSet;
    });
  };

  const handleToggleEntityVisibility = () => {
    if (!selectedEntity) return;
    setHiddenEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(selectedEntity)) {
        newSet.delete(selectedEntity);
      } else {
        newSet.add(selectedEntity);
      }
      // Update D3 node visibility
      d3.select(svgRef.current)
        .selectAll('.nodes g')
        .each(function(d: any) {
          if (d.name === selectedEntity) {
            d3.select(this).style('display', newSet.has(selectedEntity) ? 'none' : '');
          }
        });
      // Also update links connected to this entity
      d3.select(svgRef.current)
        .selectAll('.links path')
        .each(function(d: any) {
          if (d.source.id === selectedEntity || d.target.id === selectedEntity) {
            d3.select(this).style('display', newSet.has(selectedEntity) ? 'none' : '');
          }
        });
      return newSet;
    });
    setShowContextMenu(false);
  };

  const handleDeleteEntity = () => {
    if (!selectedEntity) return;

    try {
      const name = db.getData().names.find(n => n.name === selectedEntity);
      if (!name) {
        notify.error(`Entity "${selectedEntity}" not found`);
        return;
      }

      const success = db.deleteName(name.id);
      if (success) {
        notify.success(`Entity "${selectedEntity}" deleted successfully`);
        setShowContextMenu(false);
        renderGraph();
      } else {
        notify.error(`Failed to delete entity "${selectedEntity}"`);
      }
    } catch (error) {
      console.error('Error deleting entity:', error);
      notify.error('An error occurred while deleting the entity');
    }
  };

  // Close context menu when clicking elsewhere, but not if clicking inside the menu or on a node
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If context menu is open and click is outside the menu, close it
      if (
        showContextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  // Always keep selected entity node visible
  useEffect(() => {
    if (selectedEntity) {
      d3.select(svgRef.current)
        .selectAll('.nodes g')
        .each(function(d: any) {
          if (d.name === selectedEntity) {
            d3.select(this).style('display', '');
          }
        });
    }
  }, [selectedEntity, hiddenEntities]);

  // Draggable context menu handlers
  const handleMenuMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingMenu(true);
    setDragOffset({
      x: e.clientX - contextMenuPosition.x,
      y: e.clientY - contextMenuPosition.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingMenu) {
        setContextMenuPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };
    const handleMouseUp = () => setIsDraggingMenu(false);
    if (isDraggingMenu) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMenu, dragOffset]);

  const handleConnectEntities = () => {
    setConnectMode(true);
    setSourceEntity(selectedEntity);
    setShowContextMenu(false);
  };

  const handleCompleteConnection = (targetEntity: string) => {
    if (!sourceEntity || !newRelationVerb.trim()) return;
    
    try {
      // Find the IDs of the names
      const names = db.getData().names;
      const sourceNameObj = names.find(n => n.name === sourceEntity);
      const targetNameObj = names.find(n => n.name === targetEntity);
      
      if (!sourceNameObj || !targetNameObj) {
        notify.error('Source or target entity not found');
        return;
      }
      
      // Find or create the verb to get its ID
      const verb = db.findOrCreateVerb(newRelationVerb.trim());
      
      // Add the relation with the verb ID
      db.addRelation(
        Number(sourceNameObj.id), 
        verb.id, 
        Number(targetNameObj.id)
      );
      
      notify.success(`Added relation: ${sourceEntity} ${newRelationVerb} ${targetEntity}`);
      
      // Reset state and redraw
      setConnectMode(false);
      setSourceEntity(null);
      setNewRelationVerb('');
      renderGraph();
    } catch (error) {
      console.error('Error connecting entities:', error);
      notify.error('Failed to connect entities');
    }
  };

  const handleAutoOrganize = () => {
    if (!svgRef.current) return;
    
    // Unfreeze all nodes first
    d3.select(svgRef.current).selectAll('.nodes g').each((d: any) => {
      if (d.fx !== undefined) {
        d.fx = null;
        d.fy = null;
      }
    });
    
    // Run a longer, stronger simulation
    if (simulationRef.current) {
      simulationRef.current
        .alpha(0.8) // Higher alpha for more movement
        .alphaDecay(0.01) // Slower decay for longer simulation
        .velocityDecay(0.1) // Less friction for more movement
        .restart();
      
      notify.success('Auto-organizing nodes... Please wait');
    }
  };

  const renderGraph = () => {
    if (!svgRef.current) return;

    // Store current positions
    d3.select(svgRef.current).selectAll('.nodes g').each((d: any) => {
      if (d.x && d.y) {
        nodePositionsRef.current.set(d.id, { x: d.x, y: d.y });
      }
    });

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create the SVG container with a group for zooming
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
      
    // Add zoom behavior
    const zoomHandler = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });
      
    // Store zoom handler in ref for external use
    zoomHandlerRef.current = zoomHandler;
    
    // Apply zoom behavior to svg
    svg.call(zoomHandler);
    
    // Add main group that will be transformed by zoom
    const mainGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get relations data
    const relationsWithDetails = db.getRelationsWithDetails();
    
    // Get verb aliases to unify verbs
    const verbAliases = db.getData().verbs.flatMap(v => 
      v.aliases ? [{ verb: v.verb, aliases: v.aliases }] : []
    );

    // Function to get the main verb from possible aliases
    const getMainVerb = (verb: string) => {
      const alias = verbAliases.find(a => 
        (a.aliases || []).includes(verb.toLowerCase()) || a.verb.toLowerCase() === verb.toLowerCase()
      );
      return alias ? alias.verb : verb;
    };

    // Modify the filtered relations to account for hidden relations
    const filteredRelations = relationsWithDetails.filter(relation => 
      !hiddenEntities.has(relation.subject) && 
      !hiddenEntities.has(relation.object) &&
      !hiddenRelations.has(relation.id)
    );

    // Extract unique entities from filtered relations
    const entitiesSet = new Set<string>();
    filteredRelations.forEach(r => {
      entitiesSet.add(r.subject);
      entitiesSet.add(r.object);
    });

    const entities: EntityNode[] = Array.from(entitiesSet).map(name => ({
      id: name,
      name: name
    }));

    // Identify bi-directional relationships
    const relationPairs = new Map<string, string[]>();
    filteredRelations.forEach(r => {
      const key = `${r.subject}-${r.object}`;
      const reverseKey = `${r.object}-${r.subject}`;
      
      if (relationPairs.has(key)) {
        relationPairs.get(key)?.push(r.verb);
      } else {
        relationPairs.set(key, [r.verb]);
      }
      
      // Mark if there's a reverse relationship
      if (relationPairs.has(reverseKey)) {
        relationPairs.get(reverseKey)?.push('__bidirectional__');
      }
    });

    // Count occurrences for each (subject, verb, object) triple
    const relationCountMap = new Map<string, number>();
    filteredRelations.forEach(r => {
      const key = `${r.subject}|||${getMainVerb(r.verb)}|||${r.object}`;
      relationCountMap.set(key, (relationCountMap.get(key) || 0) + 1);
    });

    // Calculate event stats
    const verbCountMap = new Map<string, number>();
    filteredRelations.forEach(r => {
      const verb = getMainVerb(r.verb);
      verbCountMap.set(verb, (verbCountMap.get(verb) || 0) + 1);
    });

    const sortedStats = Array.from(verbCountMap.entries())
      .map(([verb, count]) => ({ verb, count }))
      .sort((a, b) => b.count - a.count);

    setEventStats(sortedStats);

    // Calculate most frequent relations
    const relationTripleMap = new Map<string, {count: number, relation: string}>();
    filteredRelations.forEach(r => {
      const triple = `${r.subject} ${getMainVerb(r.verb)} ${r.object}`;
      if (relationTripleMap.has(triple)) {
        relationTripleMap.get(triple)!.count++;
      } else {
        relationTripleMap.set(triple, { count: 1, relation: triple });
      }
    });

    const sortedRelationStats = Array.from(relationTripleMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 relations

    setRelationStats(sortedRelationStats);

    // Create links between entities with unified verbs, attach count
    const links: (EntityLink & { isBidirectional?: boolean, count: number })[] = filteredRelations.map(r => {
      const key = `${r.subject}-${r.object}`;
      const reverseKey = `${r.object}-${r.subject}`;
      const isBidirectional = relationPairs.has(reverseKey);
      const countKey = `${r.subject}|||${getMainVerb(r.verb)}|||${r.object}`;
      return {
        source: r.subject,
        target: r.object,
        value: 1,
        label: getMainVerb(r.verb),
        relationId: r.id,
        timeType: r.timeType as TimeType,
        frequency: r.frequency as Frequency,
        customTime: r.customTime,
        isBidirectional,
        count: relationCountMap.get(countKey) || 1
      };
    });

    // Group relations by source-verb to visualize common verbs
    type GroupedRelation = {
      source: string;
      sourceIndex: number;
      verb: string;
      targets: Array<{
        target: string;
        targetIndex: number;
        relationId: number;
        timeType?: TimeType;
        frequency?: Frequency;
        customTime?: string;
        isBidirectional?: boolean;
      }>;
    };

    // Create a map of source-verb to targets with unified verbs
    const verbRelationMap = new Map<string, GroupedRelation>();
    
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      const sourceIndex = entities.findIndex(e => e.id === sourceId);
      const targetIndex = entities.findIndex(e => e.id === targetId);
      
      const sourceNode = entities.find(e => e.id === sourceId);
      const targetNode = entities.find(e => e.id === targetId);
      
      const mainVerb = getMainVerb(link.label);
      const key = `${sourceId}-${mainVerb}`;
      
      if (!verbRelationMap.has(key)) {
        verbRelationMap.set(key, {
          source: sourceId,
          sourceIndex,
          verb: mainVerb,
          targets: []
        });
      }
      
      verbRelationMap.get(key)?.targets.push({
        target: targetId,
        targetIndex,
        relationId: link.relationId,
        timeType: link.timeType,
        frequency: link.frequency,
        customTime: link.customTime,
        isBidirectional: link.isBidirectional
      });
    });

    // After creating entities, set their initial positions
    entities.forEach(entity => {
      const pos = nodePositionsRef.current.get(entity.id);
      if (pos) {
        entity.x = pos.x;
        entity.y = pos.y;
        entity.fx = pos.x;
        entity.fy = pos.y;
      }
    });

    // Build groupedNodes and groupedLinks for D3 simulation
    const groupedNodes: EntityNode[] = [...entities]; // Start with original entities
    const groupedLinks: (EntityLink & { isJunctionMain?: boolean, isJunctionBranch?: boolean, count?: number })[] = [];
    let junctionCount = 0;

    // Process each source-verb group
    verbRelationMap.forEach((group) => {
      if (group.targets.length === 1) {
        // Single target: use original link
        const t0 = group.targets[0];
        const originalLink = links.find(l => l.relationId === t0.relationId);
        if (originalLink) {
          groupedLinks.push({ ...originalLink });
        }
      } else {
        // Multiple targets: create a junction node
        const junctionId = `junction-${group.source}-${group.verb}-${junctionCount++}`;
        
        // Calculate junction position (average of targets)
        let avgX = 0, avgY = 0;
        let validTargets = 0;
        group.targets.forEach(t => {
          const targetNode = entities.find(e => e.id === t.target);
          if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
            avgX += targetNode.x;
            avgY += targetNode.y;
            validTargets++;
          }
        });
        
        // Default to source position if no valid target positions
        const sourceNode = entities.find(e => e.id === group.source);
        const sourceX = sourceNode?.x || 0;
        const sourceY = sourceNode?.y || 0;
        
        // Calculate junction position
        if (validTargets > 0) {
          avgX /= validTargets;
          avgY /= validTargets;
        } else {
          // Position junction in front of the source if we don't have target positions
          avgX = sourceX + 100;
          avgY = sourceY + 50;
        }
        
        // Add junction node to groupedNodes
        groupedNodes.push({ 
          id: junctionId, 
          name: '', 
          x: avgX, 
          y: avgY, 
          isJunction: true 
        });
        
        // Add main link from source to junction
        groupedLinks.push({
          source: group.source,
          target: junctionId,
          value: 1,
          label: group.verb,
          relationId: -1, // Not a real relation
          isJunctionMain: true,
          count: group.targets.length // Use count for line thickness
        });
        
        // Add branch links from junction to each target
        group.targets.forEach(t => {
          // Get the count for this specific relation
          const relationCountKey = `${group.source}|||${group.verb}|||${t.target}`;
          const relationCount = relationCountMap.get(relationCountKey) || 1;
          
          groupedLinks.push({
            source: junctionId,
            target: t.target,
            value: 1,
            label: group.verb,
            relationId: t.relationId,
            timeType: t.timeType,
            frequency: t.frequency,
            customTime: t.customTime,
            isJunctionBranch: true,
            count: relationCount // Add the actual count
          });
        });
      }
    });

    // Use groupedNodes and groupedLinks for D3 simulation
    const simulation = d3.forceSimulation<EntityNode>(groupedNodes)
      .force('link', d3.forceLink<EntityNode, EntityLink>(groupedLinks).id(d => d.id)
        .distance(d => (d as any).isJunctionBranch ? 80 : 200)) // Longer distance
      .force('charge', d3.forceManyBody().strength(-600)) // Stronger repulsion
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(d => (d as any).isJunction ? 5 : 45)); // Larger collision radius

    // Store the simulation for later use
    simulationRef.current = simulation;

    // Initialize stored positions
    groupedNodes.forEach(node => {
      if (!(node as any).isJunction) { // Only for real nodes
        const pos = nodePositionsRef.current.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }
    });

    // Create gradients for each link
    const defs = mainGroup.append("defs");
    
    // Setup gradients
    groupedLinks.forEach((link, i) => {
      // Find source and target node indices
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      // Special handling for junction nodes - use source/target colors
      let sourceIndex, targetIndex;
      
      if (sourceId.startsWith('junction-')) {
        // For junction branches, use junction's "parent" color
        const junctionParts = sourceId.split('-');
        const parentId = junctionParts[1];
        sourceIndex = groupedNodes.findIndex(e => e.id === parentId);
      } else {
        sourceIndex = groupedNodes.findIndex(e => e.id === sourceId);
      }
      
      if (targetId.startsWith('junction-')) {
        // For main junction links, use first target's color
        const junctionParts = targetId.split('-');
        const parentId = junctionParts[1];
        const verb = junctionParts[2];
        const group = verbRelationMap.get(`${parentId}-${verb}`);
        if (group && group.targets.length > 0) {
          const firstTargetId = group.targets[0].target;
          targetIndex = groupedNodes.findIndex(e => e.id === firstTargetId);
        } else {
          targetIndex = 0;
        }
      } else {
        targetIndex = groupedNodes.findIndex(e => e.id === targetId);
      }
      
      const sourceColor = d3.schemeCategory10[sourceIndex % 10];
      const targetColor = d3.schemeCategory10[targetIndex % 10];
      
      // Create gradient
      const gradient = defs.append("linearGradient")
        .attr("id", `link-gradient-${i}`)
        .attr("gradientUnits", "userSpaceOnUse");
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", sourceColor)
        .attr("stop-opacity", 0.6);
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", targetColor)
        .attr("stop-opacity", 0.6);
      
      // Create arrow marker (only for non-branch links)
      if (!(link as any).isJunctionBranch && !(link as any).isBidirectional) {
        defs.append("marker")
          .attr("id", `arrowhead-${i}`)
          .attr("viewBox", "0 -3 6 6")
          .attr("refX", 28)
          .attr("refY", 0)
          .attr("markerWidth", 4)
          .attr("markerHeight", 4)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M0,-3L6,0L0,3")
          .attr("fill", targetColor)
          .attr("opacity", 0.8);
      }
    });

    // Draw links using groupedLinks
    const link = mainGroup.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(groupedLinks)
      .enter()
      .append('path')
      .attr('stroke', (d, i) => `url(#link-gradient-${i})`)
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', d => {
        // All links (main, branch, single) should respect their count
        return 2 + ((d as any).count || 1) * 1.5;
      })
      .attr('fill', 'none')
      .attr('marker-end', (d, i) => {
        // Only add arrow to main junction links and single links (not branches or bidirectional)
        if ((d as any).isJunctionBranch || (d as any).isBidirectional) return '';
        return `url(#arrowhead-${i})`;
      })
      .attr('data-verb', d => {
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as any).id;
        return `${sourceId}-${d.label}`;
      });

    // Draw bidirectional links
    const biDirectionalLinks = mainGroup.append('g')
      .attr('class', 'bidirectional-links')
      .selectAll('path')
      .data(groupedLinks.filter(d => (d as any).isBidirectional))
      .enter()
      .append('path')
      .attr('stroke', (d, i) => {
        const index = groupedLinks.findIndex(link => 
          link.source === d.source && link.target === d.target);
        return `url(#link-gradient-${index})`;
      })
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', d => 2 + ((d as any).count || 1))
      .attr('fill', 'none')
      .attr('stroke-dasharray', '5,5')
      .attr('marker-end', '')
      .attr('marker-start', '');

    // Draw link labels (clock and verb)
    const linkLabelsGroup = mainGroup.append('g')
      .attr('class', 'link-labels');
      
    const linkLabels = linkLabelsGroup
      .selectAll('.link-text-group')
      .data(groupedLinks.filter(d => !(d as any).isJunctionBranch)) // Only label main links, not branches
      .enter()
      .append('g')
      .attr('class', 'link-text-group')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if ((d as any).relationId !== -1) { // Only allow editing real relations
          handleEditTime(d);
        }
      });

    // Add clock icon for time editing (only for real relations)
    linkLabels.append('text')
      .attr('font-family', 'FontAwesome')
      .attr('font-size', 8)
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('fill', '#007BFF')
      .attr('stroke', 'white')
      .attr('stroke-width', 0.3)
      .attr('paint-order', 'stroke')
      .text(d => (d as any).timeType ? '⏱️' : '');

    // Add verb label
    linkLabels.append('text')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .attr('dy', 18)
      .attr('fill', '#333')
      .text(d => d.label);

    // Draw nodes (all except junction nodes)
    const node = mainGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(groupedNodes.filter(n => !(n as any).isJunction))
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, EntityNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('contextmenu', function(event, d) {
        event.preventDefault();
        if (connectMode && sourceEntity !== d.name) {
          handleCompleteConnection(d.name);
        } else {
          handleNodeClick(event, d);
        }
      });

    // Add circles to nodes
    node.append('circle')
      .attr('r', 25)
      .attr('fill', (_d, i) => d3.schemeCategory10[i % 10])
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('fill', (_d: any, i: number) => d3.color(d3.schemeCategory10[i % 10])?.brighter(1.2)?.toString() || '#aaa');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('fill', (_d: any, i: number) => d3.schemeCategory10[i % 10]);
      })
      .on('click', function(event, d) {
        event.preventDefault();
        if (connectMode && sourceEntity !== d.name) {
          handleCompleteConnection(d.name);
        } else {
          handleNodeClick(event, d);
        }
      })
      .on('contextmenu', function(event, d) {
        event.preventDefault();
        handleNodeClick(event, d);
      });

    // Add text labels to nodes
    node.append('text')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .text(d => d.name)
      .attr('font-size', '10px')
      .attr('fill', 'white');

    // Add title for tooltip on hover
    node.append('title')
      .text(d => d.name);

    // Simulation tick function
    simulation.on('tick', () => {
      // Update gradient start and end points for each link
      groupedLinks.forEach((link, i) => {
        const sourceNode = typeof link.source === 'object' ? link.source : { x: 0, y: 0 };
        const targetNode = typeof link.target === 'object' ? link.target : { x: 0, y: 0 };
        
        const sourceX = sourceNode.x || 0;
        const sourceY = sourceNode.y || 0;
        const targetX = targetNode.x || 0;
        const targetY = targetNode.y || 0;
        
        d3.select(`#link-gradient-${i}`)
          .attr("x1", sourceX)
          .attr("y1", sourceY)
          .attr("x2", targetX)
          .attr("y2", targetY);
      });

      // Calculate paths for links
      link.attr('d', (d: any) => {
        const sourceX = d.source.x || 0;
        const sourceY = d.source.y || 0;
        const targetX = d.target.x || 0;
        const targetY = d.target.y || 0;
        
        // If bidirectional, curve one way
        if (d.isBidirectional) {
          return `M${sourceX},${sourceY} A50,50 0 0,1 ${targetX},${targetY}`;
        } 
        
        // Straight line for all others
        return `M${sourceX},${sourceY} L${targetX},${targetY}`;
      });

      // Position bidirectional links with a curve in the opposite direction
      biDirectionalLinks.attr('d', (d: any) => {
        const sourceX = d.source.x || 0;
        const sourceY = d.source.y || 0;
        const targetX = d.target.x || 0;
        const targetY = d.target.y || 0;
        
        return `M${sourceX},${sourceY} A50,50 0 0,0 ${targetX},${targetY}`;
      });

      // Update node positions
      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      
      // Update link labels
      linkLabels.attr('transform', d => {
        const sourceX = (d.source as EntityNode).x || 0;
        const sourceY = (d.source as EntityNode).y || 0;
        const targetX = (d.target as EntityNode).x || 0;
        const targetY = (d.target as EntityNode).y || 0;
        const middleX = (sourceX + targetX) / 2;
        const middleY = (sourceY + targetY) / 2;
        return `translate(${middleX},${middleY})`;
      });
      
      // Store node positions (only real nodes, not junctions)
      groupedNodes.forEach(node => {
        if (!(node as any).isJunction && node.x !== undefined && node.y !== undefined) {
          nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
        }
      });
    });

    // Drag handlers for nodes
    function dragstarted(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      d.fx = event.x;
      d.fy = event.y;
      // Update stored position while dragging
      nodePositionsRef.current.set(d.id, { x: event.x, y: event.y });
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      // Store final position
      if (d.x && d.y) {
        nodePositionsRef.current.set(d.id, { x: d.x, y: d.y });
      }
    }
  }

  useEffect(() => {
    renderGraph();
  }, []);

  return (
    <div className="relation-graph bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-medium">Relations Network</h3>
        <div className="flex space-x-2">
          <button 
            onClick={handleZoomIn}
            className="p-2 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 flex items-center"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            onClick={handleZoomOut}
            className="p-2 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 flex items-center"
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <button 
            onClick={handleResetZoom}
            className="p-2 bg-blue-100 hover:bg-blue-200 rounded text-blue-700 flex items-center"
            title="Reset zoom"
          >
            <RefreshCw size={18} />
          </button>
          <button 
            onClick={handleAutoOrganize}
            className="p-2 bg-green-100 hover:bg-green-200 rounded text-green-700 flex items-center"
            title="Auto-organize layout"
          >
            <RefreshCw size={18} />
            <span className="ml-1">Auto-organize</span>
          </button>
          <span className="ml-2 text-sm text-gray-500 flex items-center">
            Zoom: {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>
      <div className="overflow-hidden border border-gray-200 rounded">
        <div className="text-sm text-gray-500 p-2 bg-gray-50">
          <span>Pan: Drag background • Zoom: Mouse wheel or buttons • Move node: Drag node • Click relation label to edit time • Right-click node for options</span>
        </div>
        <svg ref={svgRef} className="w-full"></svg>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-400"></div>
          <span>One-directional relationship</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-4 h-0.5 bg-gray-400 border-t border-dashed"></div>
          <span>Bi-directional relationship</span>
        </div>
      </div>

      {/* Time Edit Modal - copied from ParserPage with adaptations */}
      {showTimeModal && selectedRelation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">Edit Time Information</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">Relation:</span> {selectedRelation.source.id} {selectedRelation.label} {selectedRelation.target.id}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Type</label>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="specific"
                      checked={timeType === 'specific'}
                      onChange={() => setTimeType('specific')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Specific Time (happened once)</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="recurring"
                      checked={timeType === 'recurring'}
                      onChange={() => setTimeType('recurring')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Recurring Time</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="occasionally"
                      checked={frequency === 'occasionally'}
                      onChange={() => setFrequency('occasionally')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Occasionally</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="daily"
                      checked={frequency === 'daily'}
                      onChange={() => setFrequency('daily')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Daily</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="weekly"
                      checked={frequency === 'weekly'}
                      onChange={() => setFrequency('weekly')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Weekly</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="monthly"
                      checked={frequency === 'monthly'}
                      onChange={() => setFrequency('monthly')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Monthly</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="yearly"
                      checked={frequency === 'yearly'}
                      onChange={() => setFrequency('yearly')}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Yearly</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Time</label>
                <input
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveTime}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Panel */}
      {showStatsPanel && (
        <div className="fixed top-24 right-4 bg-white rounded-lg shadow-lg p-4 w-80 z-40">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Most Frequent Events</h3>
            <button onClick={() => setShowStatsPanel(false)} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {eventStats.map(stat => (
              <div key={stat.verb} className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>{stat.verb}</span>
                  <span className="font-medium">{stat.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (stat.count / (eventStats[0]?.count || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {eventStats.length === 0 && (
              <div className="text-gray-500 text-center py-4">No events to display</div>
            )}
          </div>
          <div className="pt-2 mt-2 border-t text-xs text-gray-500">
            Based on all visible relations in the graph
          </div>
        </div>
      )}

      {/* Connect mode indicator */}
      {connectMode && sourceEntity && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-100 text-blue-800 p-2 rounded-lg shadow-md z-50 flex flex-col items-center">
          <p className="font-medium">Connect Mode: Select a target entity</p>
          <p className="text-sm">Source: {sourceEntity}</p>
          <input
            type="text"
            value={newRelationVerb}
            onChange={(e) => setNewRelationVerb(e.target.value)}
            placeholder="Enter relationship verb..."
            className="mt-2 px-2 py-1 border rounded w-full"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConnectMode(false)}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              Cancel
            </button>
            <button
              disabled={!newRelationVerb.trim()}
              className={`px-3 py-1 rounded text-sm ${
                newRelationVerb.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Ready to Connect
            </button>
          </div>
        </div>
      )}

      {showContextMenu && selectedEntity && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white rounded-lg shadow-lg py-2 min-w-[300px] cursor-move"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            userSelect: isDraggingMenu ? 'none' : undefined
          }}
          onMouseDown={handleMenuMouseDown}
        >
          <div className="px-4 py-2 border-b border-gray-200">
            <h3 className="font-medium">{selectedEntity}</h3>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {selectedEntityRelations.length > 0 ? (
              <div className="py-2">
                {selectedEntityRelations.map((relation) => (
                  <div
                    key={relation.id}
                    className="px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {relation.subject === selectedEntity ? (
                        <>{relation.verb} → {relation.object}</>
                      ) : (
                        <>{relation.subject} → {relation.verb}</>
                      )}
                    </span>
                    <button
                      onClick={() => handleToggleRelation(relation.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {hiddenRelations.has(relation.id) ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-2 text-gray-500 text-sm">
                No relations found
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 mt-2">
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
              onClick={handleConnectEntities}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 12h8M12 8v8" />
              </svg>
              Connect to Another Entity
            </button>
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
              onClick={handleToggleEntityVisibility}
            >
              {hiddenEntities.has(selectedEntity) ? (
                <>
                  <Eye className="w-4 h-4" />
                  Show All Relations
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide All Relations
                </>
              )}
            </button>
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
              onClick={handleDeleteEntity}
            >
              <Trash2 className="w-4 h-4" />
              Delete Entity
            </button>
          </div>
        </div>
      )}

      {/* Relation Stats Panel */}
      {showRelationStats && relationStats.length > 0 && (
        <div className="fixed top-24 left-4 bg-white rounded-lg shadow-lg p-4 w-96 z-40">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Most Frequent Relations</h3>
            <button onClick={() => setShowRelationStats(false)} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {relationStats.map(stat => (
              <div key={stat.relation} className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate">{stat.relation}</span>
                  <span className="font-medium">{stat.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (stat.count / (relationStats[0]?.count || 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 mt-2 border-t text-xs text-gray-500">
            Top 10 most frequent relationships in your graph
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityTree;