import { Proposal } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ProposalStorage {
  private filePath: string;

  constructor(dataPath: string) {
    this.filePath = path.join(dataPath, 'proposals.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      await this.loadProposals();
      console.log('Proposal storage initialized');
    } catch (error) {
      console.error('Error initializing proposal storage:', error);
      // If file doesn't exist, create empty array
      await this.saveProposals([]);
    }
  }

  async saveProposal(proposal: Proposal): Promise<void> {
    const proposals = await this.loadProposals();
    proposals.push(proposal);
    await this.saveProposals(proposals);
    console.log(`Proposal saved: ${proposal.id}`);
  }

  async getProposals(filter?: { status?: string }): Promise<Proposal[]> {
    let proposals = await this.loadProposals();
    
    if (filter?.status) {
      proposals = proposals.filter(p => p.status === filter.status);
    }

    // Sort by timestamp descending
    proposals.sort((a, b) => b.timestamp - a.timestamp);
    
    return proposals;
  }

  async getProposal(id: string): Promise<Proposal | null> {
    const proposals = await this.loadProposals();
    return proposals.find(p => p.id === id) || null;
  }

  async updateProposal(id: string, updates: Partial<Proposal>): Promise<void> {
    const proposals = await this.loadProposals();
    const index = proposals.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error(`Proposal ${id} not found`);
    }

    proposals[index] = { ...proposals[index], ...updates };
    await this.saveProposals(proposals);
    console.log(`Proposal updated: ${id}`);
  }

  async deleteProposal(id: string): Promise<void> {
    let proposals = await this.loadProposals();
    proposals = proposals.filter(p => p.id !== id);
    await this.saveProposals(proposals);
    console.log(`Proposal deleted: ${id}`);
  }

  async clearPendingProposals(): Promise<void> {
    const proposals = await this.loadProposals();
    const pending = proposals.filter(p => p.status === 'pending');
    await this.saveProposals(pending);
    console.log(`Cleared non-pending proposals, kept ${pending.length} pending`);
  }

  private async loadProposals(): Promise<Proposal[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async saveProposals(proposals: Proposal[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(proposals, null, 2));
  }

  private async ensureDataDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
