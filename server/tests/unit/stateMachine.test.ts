import { describe, it, expect } from 'vitest';
import { isValidTransition, requiresManagerRole, getValidTransitions, getStatusLabel } from '../../src/utils/stateMachine';

describe('State Machine', () => {
  it('should validate allowed transitions', () => {
    expect(isValidTransition('open', 'in_progress')).toBe(true);
    expect(isValidTransition('in_progress', 'under_review')).toBe(true);
    expect(isValidTransition('under_review', 'resolved')).toBe(true);
    expect(isValidTransition('resolved', 'closed')).toBe(true);
    expect(isValidTransition('closed', 'open')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(isValidTransition('open', 'resolved')).toBe(false);
    expect(isValidTransition('open', 'under_review')).toBe(false);
    expect(isValidTransition('blocked', 'closed')).toBe(false);
  });

  it('should correctly identify manager-required transitions', () => {
    expect(requiresManagerRole('resolved', 'closed')).toBe(true);
    expect(requiresManagerRole('open', 'closed')).toBe(true);
    expect(requiresManagerRole('closed', 'open')).toBe(true);
    
    expect(requiresManagerRole('open', 'in_progress')).toBe(false);
    expect(requiresManagerRole('in_progress', 'under_review')).toBe(false);
  });

  it('should return valid transitions for a given state', () => {
    expect(getValidTransitions('open')).toEqual(['in_progress', 'closed']);
    expect(getValidTransitions('under_review')).toEqual(['resolved', 'in_progress']);
  });

  it('should return the correct status label', () => {
    expect(getStatusLabel('in_progress')).toBe('In Progress');
    expect(getStatusLabel('under_review')).toBe('Under Review');
  });
});
