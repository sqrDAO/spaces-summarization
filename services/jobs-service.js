import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class JobsService {
  constructor(options = {}) {
    // Store jobs in memory
    this.jobs = new Map();
    
    // Set up logs directory
    this.logsDir = options.logsDir || path.join(__dirname, '..', 'logs');
    
    // Ensure logs directory exists
    this.ensureLogsDirectory();
  }
  
  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
        console.log(`Created logs directory at ${this.logsDir}`);
      } catch (error) {
        console.error(`Failed to create logs directory: ${error.message}`);
      }
    }
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
      error: null,
      logs: [] // Initialize logs array
    };
    
    this.jobs.set(jobId, job);
    
    // Initialize job log file
    this.initJobLogFile(jobId);
    
    // Add first log entry
    this.addJobLog(jobId, `Job created: ${type}`, 'info');
    
    return jobId;
  }
  
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    
    // Make sure logs are loaded - they might be stored on disk
    // to save memory for long-running jobs
    if (!job.logs || job.logs.length === 0) {
      job.logs = this.readJobLogs(jobId);
    }
    
    return job;
  }
  
  updateJob(jobId, status, data = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    const oldStatus = job.status;
    job.status = status;
    job.updatedAt = new Date();
    
    if (data.result) job.result = data.result;
    if (data.error) job.error = data.error;
    
    this.jobs.set(jobId, job);
    
    // Log status change
    if (oldStatus !== status) {
      this.addJobLog(jobId, `Job status changed: ${oldStatus} → ${status}`, 'info');
    }
    
    // Log result or error
    if (data.result) {
      this.addJobLog(jobId, 'Job completed successfully', 'success');
    }
    
    if (data.error) {
      this.addJobLog(jobId, `Job failed: ${data.error}`, 'error');
    }
    
    return true;
  }
  
  addJobLog(jobId, message, type = 'info', data = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found for logging`);
      return false;
    }
    
    // Initialize logs array if it doesn't exist
    if (!job.logs) {
      job.logs = [];
    }
    
    // Create log entry
    const timestamp = new Date();
    const logEntry = {
      timestamp: timestamp.toISOString(),
      message,
      type,
      data
    };
    
    // Add to memory logs
    job.logs.push(logEntry);
    
    // Write to log file
    this.writeToJobLogFile(jobId, logEntry);
    
    return true;
  }
  
  generateJobId() {
    return 'job_' + Date.now() + '_' + 
      crypto.randomBytes(4).toString('hex');
  }
  
  listJobs() {
    return [...this.jobs.values()].map(job => {
      // For the job list, we don't need to include all logs
      // to keep the response size reasonable
      const { logs, ...jobWithoutLogs } = job;
      return {
        ...jobWithoutLogs,
        logsCount: logs ? logs.length : 0
      };
    });
  }
  
  // Get the path to the log file for a job
  getJobLogPath(jobId) {
    return path.join(this.logsDir, `${jobId}.log`);
  }
  
  // Initialize a log file for a new job
  initJobLogFile(jobId) {
    const logPath = this.getJobLogPath(jobId);
    try {
      // Create the file with a header
      const header = `=== Job ${jobId} Log ===\nCreated: ${new Date().toISOString()}\n\n`;
      fs.writeFileSync(logPath, header);
      console.log(`Initialized log file for job ${jobId}`);
    } catch (error) {
      console.error(`Failed to initialize log file for job ${jobId}: ${error.message}`);
    }
  }
  
  // Write a log entry to the job's log file
  writeToJobLogFile(jobId, logEntry) {
    const logPath = this.getJobLogPath(jobId);
    try {
      const formattedTime = new Date(logEntry.timestamp).toLocaleTimeString();
      let logLine = `[${formattedTime}] [${logEntry.type.toUpperCase()}] ${logEntry.message}\n`;
      
      // Add data if present
      if (logEntry.data) {
        try {
          const dataStr = JSON.stringify(logEntry.data);
          logLine += `  Data: ${dataStr}\n`;
        } catch (err) {
          // If data can't be stringified, just mention it
          logLine += '  Data: [Cannot display data]\n';
        }
      }
      
      // Append to file
      fs.appendFileSync(logPath, logLine);
    } catch (error) {
      console.error(`Failed to write to log file for job ${jobId}: ${error.message}`);
    }
  }
  
  // Read all logs from a job's log file
  readJobLogs(jobId) {
    const logPath = this.getJobLogPath(jobId);
    const logs = [];
    
    try {
      if (fs.existsSync(logPath)) {
        // Parse log file and reconstruct log entries
        const fileContent = fs.readFileSync(logPath, 'utf8');
        const lines = fileContent.split('\n');
        
        // Skip header (first 3 lines)
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Try to parse log lines in format [time] [type] message
          const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/);
          if (match) {
            const time = match[1];
            const type = match[2].toLowerCase();
            const message = match[3];
            
            // Look for data line (indented with "Data: ")
            let data = null;
            if (i + 1 < lines.length && lines[i + 1].trim().startsWith('  Data: ')) {
              try {
                const dataStr = lines[i + 1].trim().substring(7); // Remove "  Data: "
                data = JSON.parse(dataStr);
                i++; // Skip the data line in the next iteration
              } catch (err) {
                // If data can't be parsed, just ignore it
              }
            }
            
            // Create a timestamp - try to parse the time format
            let timestamp;
            try {
              // Assume the timestamp is in local time, convert to ISO
              const today = new Date().toLocaleDateString();
              timestamp = new Date(`${today} ${time}`).toISOString();
            } catch (err) {
              // If parsing fails, use the current time
              timestamp = new Date().toISOString();
            }
            
            logs.push({
              timestamp,
              type,
              message,
              data
            });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read log file for job ${jobId}: ${error.message}`);
    }
    
    return logs;
  }
  
  // Get the raw log file content for a job
  getRawJobLog(jobId) {
    const logPath = this.getJobLogPath(jobId);
    try {
      if (fs.existsSync(logPath)) {
        return fs.readFileSync(logPath, 'utf8');
      }
    } catch (error) {
      console.error(`Failed to read raw log file for job ${jobId}: ${error.message}`);
    }
    return null;
  }
}

export default JobsService;