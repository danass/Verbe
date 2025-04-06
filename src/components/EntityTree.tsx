import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { db } from '../database';

// Interface pour les données de simulation D3
interface EntityNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
}

interface EntityLink {
  source: string | EntityNode;
  target: string | EntityNode;
  value: number;
  label: string;
}

const EntityTree: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get relations data
    const relations = db.getRelationsWithDetails();
    
    // Extract unique entities (subjects and objects)
    const entitiesSet = new Set<string>();
    relations.forEach(r => {
      entitiesSet.add(r.subject);
      entitiesSet.add(r.object);
    });
    
    const entities: EntityNode[] = Array.from(entitiesSet).map(name => ({
      id: name,
      name: name
    }));

    // Create links between entities
    const links: EntityLink[] = relations.map(r => ({
      source: r.subject,
      target: r.object,
      value: 1,  // Strength of the link, could be based on frequency
      label: r.verb
    }));

    // Create a force simulation
    const simulation = d3.forceSimulation<EntityNode>(entities)
      .force('link', d3.forceLink<EntityNode, EntityLink>(links)
        .id(d => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Draw links
    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    // Add link labels (verb names)
    const linkLabels = svg.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .text(d => d.label);

    // Draw nodes
    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(entities)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, EntityNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes
    node.append('circle')
      .attr('r', 25)
      .attr('fill', (_d, i) => d3.schemeCategory10[i % 10])
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

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

    // Update positions on each tick of the simulation
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as EntityNode).x || 0)
        .attr('y1', d => (d.source as EntityNode).y || 0)
        .attr('x2', d => (d.target as EntityNode).x || 0)
        .attr('y2', d => (d.target as EntityNode).y || 0);

      // Position label at the middle of the link
      linkLabels
        .attr('x', d => (((d.source as EntityNode).x || 0) + ((d.target as EntityNode).x || 0)) / 2)
        .attr('y', d => (((d.source as EntityNode).y || 0) + ((d.target as EntityNode).y || 0)) / 2);

      node
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, EntityNode, EntityNode>, d: EntityNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }, []);

  return (
    <div className="relation-graph bg-white p-4 rounded-lg shadow">
      <h3 className="text-xl font-medium mb-4">Relations Network</h3>
      <div className="overflow-hidden">
        <svg ref={svgRef} className="w-full border border-gray-200 rounded"></svg>
      </div>
    </div>
  );
};

export default EntityTree;