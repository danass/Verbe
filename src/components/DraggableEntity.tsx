import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Name } from '../types';

interface DraggableEntityProps {
  entity: Name;
  onDrop: (draggedId: number, targetId: number) => void;
}

export const DraggableEntity: React.FC<DraggableEntityProps> = ({ entity, onDrop }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'entity',
    item: { id: entity.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'entity',
    drop: (item: { id: number }) => {
      if (item.id !== entity.id) {
        onDrop(item.id, entity.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`
        p-4 rounded-lg border-2 cursor-move
        ${isDragging ? 'opacity-50' : ''}
        ${isOver ? 'border-blue-500' : 'border-gray-200'}
      `}
    >
      <h3 className="font-medium">{entity.name}</h3>
      {entity.children && entity.children.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {entity.children.map(child => (
            <DraggableEntity
              key={child.id}
              entity={child}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
};