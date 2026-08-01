// Presentation metadata for each node type: emoji + Tailux color classes.
// Kept framework-agnostic so both the palette and the canvas nodes share it.
import type { WorkflowNodeType } from './node-types';

export interface NodeVisual {
  emoji: string;
  /** Tailwind classes for the node accent (border + header bg + text). */
  ring: string;
  headerBg: string;
  text: string;
  /** Small dot color for the palette. */
  dot: string;
}

export const NODE_VISUALS: Record<WorkflowNodeType, NodeVisual> = {
  start:        { emoji: '▶️', ring: 'border-success-500', headerBg: 'bg-success-500/10', text: 'text-success-600 dark:text-success-400', dot: 'bg-success-500' },
  end:          { emoji: '⏹️', ring: 'border-gray-400', headerBg: 'bg-gray-400/10', text: 'text-gray-600 dark:text-dark-100', dot: 'bg-gray-400' },
  approval:     { emoji: '✅', ring: 'border-primary-500', headerBg: 'bg-primary-500/10', text: 'text-primary-600 dark:text-primary-400', dot: 'bg-primary-500' },
  humanTask:    { emoji: '📋', ring: 'border-primary-400', headerBg: 'bg-primary-400/10', text: 'text-primary-600 dark:text-primary-400', dot: 'bg-primary-400' },
  form:         { emoji: '📝', ring: 'border-info', headerBg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  condition:    { emoji: '🔀', ring: 'border-warning', headerBg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  parallelSplit:{ emoji: '🪢', ring: 'border-secondary', headerBg: 'bg-secondary/10', text: 'text-secondary', dot: 'bg-secondary' },
  parallelJoin: { emoji: '🔗', ring: 'border-secondary', headerBg: 'bg-secondary/10', text: 'text-secondary', dot: 'bg-secondary' },
  timer:        { emoji: '⏲️', ring: 'border-warning', headerBg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  notification: { emoji: '🔔', ring: 'border-info', headerBg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  serviceCall:  { emoji: '🔌', ring: 'border-secondary', headerBg: 'bg-secondary/10', text: 'text-secondary', dot: 'bg-secondary' },
  subflow:      { emoji: '♻️', ring: 'border-primary-400', headerBg: 'bg-primary-400/10', text: 'text-primary-600 dark:text-primary-400', dot: 'bg-primary-400' },
  aiAssist:     { emoji: '✨', ring: 'border-primary-500', headerBg: 'bg-primary-500/10', text: 'text-primary-600 dark:text-primary-400', dot: 'bg-primary-500' },
};

export function nodeVisual(type: string): NodeVisual {
  return NODE_VISUALS[type as WorkflowNodeType] ?? NODE_VISUALS.humanTask;
}
