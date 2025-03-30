import crypto from 'crypto';

class JobsService {
  constructor() {
    // Store jobs in memory
    this.jobs = new Map();
  }
  
  createJob(type, params = {}) {
    const jobId = this.generateJobId();
    const job = {
      id: jobId,
      type,
      params,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      result: null,
      error: null
    };
    
    this.jobs.set(jobId, job);
    return jobId;
  }
  
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }
  
  updateJob(jobId, status, data = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    job.status = status;
    job.updatedAt = new Date();
    
    if (data.result) job.result = data.result;
    if (data.error) job.error = data.error;
    
    this.jobs.set(jobId, job);
    return true;
  }
  
  generateJobId() {
    return 'job_' + Date.now() + '_' + 
      crypto.randomBytes(4).toString('hex');
  }
  
  listJobs() {
    return [...this.jobs.values()];
  }
}

export default JobsService;