import { Proposal } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class ProposalStorage {
  private filePath: string;
  private supabase?: SupabaseClient;
  private useSupabase: boolean;
  private table: string;

  constructor(dataPath: string) {
    this.filePath = path.join(dataPath, 'proposals.json');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    this.table = process.env.SUPABASE_TABLE || 'proposals';
    this.useSupabase = !!(url && key);
    if (this.useSupabase) {
      this.supabase = createClient(url!, key!, { auth: { persistSession: false } });
      console.log(`Proposal storage: Supabase (${this.table})`);
    } else {
      console.log('Proposal storage: local JSON file');
    }
  }

  async initialize(): Promise<void> {
    try {
      if (this.useSupabase) {
        await this.loadProposals();
        console.log('Proposal storage initialized (Supabase)');
        return;
      }
      await this.ensureDataDirectory();
      await this.loadProposals();
      console.log('Proposal storage initialized');
    } catch (error) {
      console.error('Error initializing proposal storage:', error);
      // If file doesn't exist, create empty array
      if (!this.useSupabase) {
        await this.saveProposals([]);
      }
    }
  }

  async saveProposal(proposal: Proposal): Promise<void> {
    if (this.useSupabase && this.supabase) {
      const { error } = await this.supabase
        .from(this.table)
        .upsert(this.toSupabase(proposal), { onConflict: 'id' });
      if (error) throw error;
      console.log(`Proposal saved: ${proposal.id}`);
      return;
    }
    const proposals = await this.loadProposals();
    proposals.push(proposal);
    await this.saveProposals(proposals);
    console.log(`Proposal saved: ${proposal.id}`);
  }

  async getProposals(filter?: { status?: string }): Promise<Proposal[]> {
    if (this.useSupabase && this.supabase) {
      let query = this.supabase.from(this.table).select('*');
      if (filter?.status) query = query.eq('status', filter.status);
      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(this.fromSupabase);
    }
    let proposals = await this.loadProposals();
    if (filter?.status) {
      proposals = proposals.filter(p => p.status === filter.status);
    }
    proposals.sort((a, b) => b.timestamp - a.timestamp);
    return proposals;
  }

  async getProposal(id: string): Promise<Proposal | null> {
    if (this.useSupabase && this.supabase) {
      const { data, error } = await this.supabase.from(this.table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? this.fromSupabase(data) : null;
    }
    const proposals = await this.loadProposals();
    return proposals.find(p => p.id === id) || null;
  }

  async updateProposal(id: string, updates: Partial<Proposal>): Promise<void> {
    if (this.useSupabase && this.supabase) {
      const payload = this.toSupabase({ ...updates, id } as Proposal);
      const { error } = await this.supabase.from(this.table).update(payload).eq('id', id);
      if (error) throw error;
      console.log(`Proposal updated: ${id}`);
      return;
    }
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
    if (this.useSupabase && this.supabase) {
      const { error } = await this.supabase.from(this.table).delete().eq('id', id);
      if (error) throw error;
      console.log(`Proposal deleted: ${id}`);
      return;
    }
    let proposals = await this.loadProposals();
    proposals = proposals.filter(p => p.id !== id);
    await this.saveProposals(proposals);
    console.log(`Proposal deleted: ${id}`);
  }

  async clearPendingProposals(): Promise<void> {
    if (this.useSupabase && this.supabase) {
      const { error } = await this.supabase.from(this.table).delete().neq('status', 'pending');
      if (error) throw error;
      console.log('Cleared non-pending proposals (Supabase)');
      return;
    }
    const proposals = await this.loadProposals();
    const pending = proposals.filter(p => p.status === 'pending');
    await this.saveProposals(pending);
    console.log(`Cleared non-pending proposals, kept ${pending.length} pending`);
  }

  private async loadProposals(): Promise<Proposal[]> {
    if (this.useSupabase && this.supabase) {
      const { data, error } = await this.supabase.from(this.table).select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(this.fromSupabase);
    }
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

  private toSupabase(proposal: Proposal): Record<string, any> {
    return {
      id: proposal.id,
      timestamp: proposal.timestamp,
      type: proposal.type,
      token: proposal.token,
      amount: proposal.amount,
      strategy: proposal.strategy,
      reason: proposal.reason,
      status: proposal.status,
      tx_hash: proposal.txHash ?? null,
      execution_time: proposal.executionTime ?? null,
    };
  }

  private fromSupabase = (row: any): Proposal => ({
    id: row.id,
    timestamp: Number(row.timestamp),
    type: row.type,
    token: row.token,
    amount: row.amount,
    strategy: row.strategy,
    reason: row.reason,
    status: row.status,
    txHash: row.tx_hash ?? undefined,
    executionTime: row.execution_time ?? undefined,
  });
}
