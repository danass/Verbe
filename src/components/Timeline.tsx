import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TimelineData } from '../types';

interface TimelineProps {
  data: TimelineData[];
  selectedEntity?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ data, selectedEntity }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 100 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const filteredData = selectedEntity 
      ? data.filter(d => d.subject === selectedEntity || d.object === selectedEntity)
      : data;

    const x = d3.scaleTime()
      .domain(d3.extent(filteredData, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, width]);

    const y = d3.scaleBand()
      .domain(filteredData.map(d => `${d.subject} ${d.verb} ${d.object}`))
      .range([0, height])
      .padding(0.1);

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(y));

    // Add dots
    svg.selectAll("circle")
      .data(filteredData)
      .enter()
      .append("circle")
      .attr("cx", d => x(new Date(d.timestamp)))
      .attr("cy", d => (y(`${d.subject} ${d.verb} ${d.object}`) || 0) + y.bandwidth() / 2)
      .attr("r", 5)
      .style("fill", "#3b82f6")
      .style("opacity", 0.7)
      .on("mouseover", (event, d) => {
        const tooltip = d3.select("#tooltip");
        tooltip.style("opacity", 1)
          .html(`${d.subject} ${d.verb} ${d.object}<br/>${new Date(d.timestamp).toLocaleString()}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", () => {
        d3.select("#tooltip").style("opacity", 0);
      });

  }, [data, selectedEntity]);

  return (
    <div className="relative">
      <svg ref={svgRef}></svg>
      <div
        id="tooltip"
        className="absolute opacity-0 bg-black text-white p-2 rounded text-sm pointer-events-none transition-opacity"
        style={{ zIndex: 1000 }}
      ></div>
    </div>
  );
};