import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * 1. Get All Workers
 */
export const getWorkers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        name, 
        phone, 
        designation, 
        salary_type, 
        monthly_salary, 
        daily_wage, 
        joining_date, 
        is_active, 
        notes, 
        franchise_id, 
        created_at
      FROM workers
      WHERE is_active = true
      ORDER BY name ASC
    `);

    res.json({ workers: result.rows });
  } catch (error: any) {
    console.error("Error fetching workers:", error);
    res.status(500).json({ message: "कामगारांची माहिती लोड करता आली नाही", error: error.message });
  }
};

/**
 * 2. Add New Worker
 */
export const createWorker = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, designation, salary_type, monthly_salary, daily_wage, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "कामगाराचे नाव आवश्यक आहे" });
    }

    const mSalary = parseFloat(monthly_salary) || 0;
    let dWage = parseFloat(daily_wage) || 0;

    // If daily wage not specified but monthly salary is given, calculate daily wage (salary / 30)
    if (dWage <= 0 && mSalary > 0) {
      dWage = Math.round((mSalary / 30) * 100) / 100;
    }

    const fRes = await pool.query("SELECT id FROM franchises ORDER BY id ASC LIMIT 1");
    const franchiseId = req.user?.franchise_id || fRes.rows[0]?.id || 1;

    const result = await pool.query(`
      INSERT INTO workers (name, phone, designation, salary_type, monthly_salary, daily_wage, notes, franchise_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      name.trim(),
      phone ? phone.trim() : null,
      designation ? designation.trim() : "कामगार",
      salary_type || "monthly",
      mSalary,
      dWage,
      notes || null,
      franchiseId
    ]);

    res.status(201).json({
      message: "कामगार यशस्वीरित्या जोडला गेला",
      worker: result.rows[0]
    });
  } catch (error: any) {
    console.error("Error creating worker:", error);
    res.status(500).json({ message: "कामगार जोडताना त्रुटी आली", error: error.message });
  }
};

/**
 * 3. Update Worker
 */
export const updateWorker = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, designation, salary_type, monthly_salary, daily_wage, notes } = req.body;

    const mSalary = parseFloat(monthly_salary) || 0;
    let dWage = parseFloat(daily_wage) || 0;
    if (dWage <= 0 && mSalary > 0) {
      dWage = Math.round((mSalary / 30) * 100) / 100;
    }

    const result = await pool.query(`
      UPDATE workers 
      SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        designation = COALESCE($3, designation),
        salary_type = COALESCE($4, salary_type),
        monthly_salary = $5,
        daily_wage = $6,
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *
    `, [name, phone, designation, salary_type, mSalary, dWage, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "कामगार सापडला नाही" });
    }

    res.json({ message: "कामगाराची माहिती अपडेट केली", worker: result.rows[0] });
  } catch (error: any) {
    console.error("Error updating worker:", error);
    res.status(500).json({ message: "कामगार अपडेट करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 4. Delete / Deactivate Worker
 */
export const deleteWorker = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE workers SET is_active = false WHERE id = $1", [id]);
    res.json({ message: "कामगार यशस्वीरित्या हटवला गेला" });
  } catch (error: any) {
    console.error("Error deleting worker:", error);
    res.status(500).json({ message: "कामगार डिलीट करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 5. Get Attendance For a Specific Date
 * Query: ?date=YYYY-MM-DD
 */
export const getAttendanceByDate = async (req: AuthRequest, res: Response) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split("T")[0];

    const result = await pool.query(`
      SELECT 
        w.id as worker_id,
        w.name as worker_name,
        w.phone as worker_phone,
        w.designation as worker_designation,
        w.monthly_salary,
        w.daily_wage,
        a.id as attendance_id,
        COALESCE(a.status, 'unmarked') as status,
        COALESCE(a.multiplier, 0) as multiplier,
        a.notes,
        a.attendance_date
      FROM workers w
      LEFT JOIN worker_attendance a 
        ON w.id = a.worker_id AND a.attendance_date = $1
      WHERE w.is_active = true
      ORDER BY w.name ASC
    `, [targetDate]);

    // Calculate count breakdown
    let fullDayCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;

    result.rows.forEach((r) => {
      if (r.status === "full_day") fullDayCount++;
      else if (r.status === "half_day") halfDayCount++;
      else if (r.status === "absent") absentCount++;
      else unmarkedCount++;
    });

    res.json({
      date: targetDate,
      summary: {
        total_workers: result.rows.length,
        full_day: fullDayCount,
        half_day: halfDayCount,
        absent: absentCount,
        unmarked: unmarkedCount,
        effective_present: fullDayCount + (halfDayCount * 0.5)
      },
      records: result.rows
    });
  } catch (error: any) {
    console.error("Error fetching attendance by date:", error);
    res.status(500).json({ message: "हजेरी लोड करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 6. Save or Update Attendance for One or Multiple Workers
 * Body: { date: 'YYYY-MM-DD', records: [{ worker_id, status: 'full_day'|'half_day'|'absent', notes?: '' }] }
 */
export const saveAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { date, records } = req.body;
    const recordedBy = req.user?.id || null;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: "तारीख आणि हजेरी नोंदी आवश्यक आहेत" });
    }

    for (const item of records) {
      const { worker_id, status, notes } = item;
      if (!worker_id || !status) continue;

      let multiplier = 1.0;
      if (status === "half_day") multiplier = 0.5;
      else if (status === "absent") multiplier = 0.0;

      await pool.query(`
        INSERT INTO worker_attendance (worker_id, attendance_date, status, multiplier, notes, recorded_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (worker_id, attendance_date) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          multiplier = EXCLUDED.multiplier,
          notes = EXCLUDED.notes,
          recorded_by_user_id = EXCLUDED.recorded_by_user_id,
          updated_at = CURRENT_TIMESTAMP
      `, [worker_id, date, status, multiplier, notes || null, recordedBy]);
    }

    res.json({ message: "हजेरी यशस्वीरित्या सेव्ह झाली" });
  } catch (error: any) {
    console.error("Error saving attendance:", error);
    res.status(500).json({ message: "हजेरी सेव्ह करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 7. Get Worker Advances (उचल)
 * Query: ?workerId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getAdvances = async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        a.id,
        a.worker_id,
        w.name as worker_name,
        w.phone as worker_phone,
        a.amount,
        a.advance_date,
        a.payment_mode,
        a.notes,
        a.created_at,
        u.name as recorded_by_name
      FROM worker_advances a
      JOIN workers w ON a.worker_id = w.id
      LEFT JOIN users u ON a.recorded_by_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (workerId) {
      params.push(workerId);
      query += ` AND a.worker_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND a.advance_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND a.advance_date <= $${params.length}`;
    }

    query += ` ORDER BY a.advance_date DESC, a.id DESC`;

    const result = await pool.query(query, params);

    const totalAdvance = result.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    res.json({
      advances: result.rows,
      total_advance_amount: totalAdvance
    });
  } catch (error: any) {
    console.error("Error fetching advances:", error);
    res.status(500).json({ message: "उचल नोंदी लोड करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 8. Add New Advance (उचल देणे)
 * Body: { worker_id, amount, advance_date, payment_mode, notes }
 */
export const addAdvance = async (req: AuthRequest, res: Response) => {
  try {
    const { worker_id, amount, advance_date, payment_mode, notes } = req.body;
    const recordedBy = req.user?.id || null;

    if (!worker_id || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "कामगार आणि वैध रक्कम आवश्यक आहे" });
    }

    const date = advance_date || new Date().toISOString().split("T")[0];

    const result = await pool.query(`
      INSERT INTO worker_advances (worker_id, amount, advance_date, payment_mode, notes, recorded_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [worker_id, parseFloat(amount), date, payment_mode || "cash", notes || null, recordedBy]);

    res.status(201).json({
      message: "उचल नोंद यशस्वीरित्या जमा झाली",
      advance: result.rows[0]
    });
  } catch (error: any) {
    console.error("Error adding advance:", error);
    res.status(500).json({ message: "उचल नोंदवताना त्रुटी आली", error: error.message });
  }
};

/**
 * 9. Delete Advance
 */
export const deleteAdvance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM worker_advances WHERE id = $1", [id]);
    res.json({ message: "उचल नोंद हटवली गेली" });
  } catch (error: any) {
    console.error("Error deleting advance:", error);
    res.status(500).json({ message: "उचल डिलीट करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 10. Comprehensive Salary Report (Monthly or Custom Date Range)
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&workerId=optional
 */
export const getSalaryReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, workerId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "सुरुवात तारीख (startDate) आणि शेवट तारीख (endDate) आवश्यक आहे" });
    }

    // 1. Fetch active workers (or single worker if filtered)
    let workersQuery = `SELECT * FROM workers WHERE is_active = true`;
    const wParams: any[] = [];
    if (workerId) {
      wParams.push(workerId);
      workersQuery += ` AND id = $1`;
    }
    workersQuery += ` ORDER BY name ASC`;
    const workersRes = await pool.query(workersQuery, wParams);
    const workers = workersRes.rows;

    // 2. Fetch all attendance in this range
    let attQuery = `
      SELECT 
        worker_id, 
        attendance_date, 
        status, 
        multiplier, 
        notes 
      FROM worker_attendance
      WHERE attendance_date >= $1 AND attendance_date <= $2
    `;
    const attParams: any[] = [startDate, endDate];
    if (workerId) {
      attParams.push(workerId);
      attQuery += ` AND worker_id = $3`;
    }
    attQuery += ` ORDER BY attendance_date ASC`;
    const attRes = await pool.query(attQuery, attParams);

    // 3. Fetch all advances in this range
    let advQuery = `
      SELECT 
        id, 
        worker_id, 
        amount, 
        advance_date, 
        payment_mode, 
        notes 
      FROM worker_advances
      WHERE advance_date >= $1 AND advance_date <= $2
    `;
    const advParams: any[] = [startDate, endDate];
    if (workerId) {
      advParams.push(workerId);
      advQuery += ` AND worker_id = $3`;
    }
    advQuery += ` ORDER BY advance_date ASC`;
    const advRes = await pool.query(advQuery, advParams);

    // 4. Calculate for each worker
    const report = workers.map((w) => {
      const wAttendance = attRes.rows.filter((a) => a.worker_id === w.id);
      const wAdvances = advRes.rows.filter((adv) => adv.worker_id === w.id);

      let fullDays = 0;
      let halfDays = 0;
      let absentDays = 0;

      wAttendance.forEach((a) => {
        if (a.status === "full_day") fullDays++;
        else if (a.status === "half_day") halfDays++;
        else if (a.status === "absent") absentDays++;
      });

      const effectiveWorkingDays = fullDays + (halfDays * 0.5);

      const monthlySalary = parseFloat(w.monthly_salary) || 0;
      let dailyWage = parseFloat(w.daily_wage) || 0;
      if (dailyWage <= 0 && monthlySalary > 0) {
        dailyWage = Math.round((monthlySalary / 30) * 100) / 100;
      }

      // Calculate earned salary based on effective days worked
      const earnedSalary = Math.round(effectiveWorkingDays * dailyWage * 100) / 100;

      // Calculate total advances in this period
      const totalAdvance = wAdvances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      // Remaining net payable salary
      const netPayable = Math.round((earnedSalary - totalAdvance) * 100) / 100;

      return {
        worker_id: w.id,
        worker_name: w.name,
        worker_phone: w.phone,
        designation: w.designation,
        salary_type: w.salary_type,
        monthly_salary: monthlySalary,
        daily_wage: dailyWage,
        full_days: fullDays,
        half_days: halfDays,
        absent_days: absentDays,
        effective_working_days: effectiveWorkingDays,
        earned_salary: earnedSalary,
        total_advance: totalAdvance,
        net_payable: netPayable,
        advances: wAdvances,
        attendance_logs: wAttendance
      };
    });

    // Grand totals
    const grandTotals = {
      total_workers: report.length,
      total_effective_days: report.reduce((sum, r) => sum + r.effective_working_days, 0),
      total_earned_salary: report.reduce((sum, r) => sum + r.earned_salary, 0),
      total_advance_given: report.reduce((sum, r) => sum + r.total_advance, 0),
      total_net_payable: report.reduce((sum, r) => sum + r.net_payable, 0)
    };

    res.json({
      period: {
        startDate,
        endDate
      },
      grand_totals: grandTotals,
      workers: report
    });
  } catch (error: any) {
    console.error("Error generating salary report:", error);
    res.status(500).json({ message: "पगार अहवाल तयार करताना त्रुटी आली", error: error.message });
  }
};

/**
 * 11. Record Salary Settlement (पगार चुकता केला)
 */
export const recordSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const {
      worker_id,
      month_year,
      total_days,
      base_salary,
      earned_salary,
      advance_deducted,
      net_paid_amount,
      payment_date,
      payment_mode,
      notes
    } = req.body;

    const recordedBy = req.user?.id || null;

    if (!worker_id || !month_year || net_paid_amount === undefined) {
      return res.status(400).json({ message: "कामगार, महिना आणि दिलेली रक्कम आवश्यक आहे" });
    }

    const result = await pool.query(`
      INSERT INTO worker_salary_settlements (
        worker_id, 
        month_year, 
        total_days, 
        base_salary, 
        earned_salary, 
        advance_deducted, 
        net_paid_amount, 
        payment_date, 
        payment_mode, 
        notes, 
        recorded_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      worker_id,
      month_year,
      parseFloat(total_days) || 0,
      parseFloat(base_salary) || 0,
      parseFloat(earned_salary) || 0,
      parseFloat(advance_deducted) || 0,
      parseFloat(net_paid_amount) || 0,
      payment_date || new Date().toISOString().split("T")[0],
      payment_mode || "cash",
      notes || null,
      recordedBy
    ]);

    res.status(201).json({
      message: "पगार चुकता केल्याची नोंद यशस्वीरित्या झाली",
      settlement: result.rows[0]
    });
  } catch (error: any) {
    console.error("Error recording settlement:", error);
    res.status(500).json({ message: "पगार नोंदवताना त्रुटी आली", error: error.message });
  }
};

/**
 * 12. Get Past Settlements
 */
export const getSettlements = async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, month_year } = req.query;

    let query = `
      SELECT 
        s.*,
        w.name as worker_name,
        w.phone as worker_phone,
        u.name as recorded_by_name
      FROM worker_salary_settlements s
      JOIN workers w ON s.worker_id = w.id
      LEFT JOIN users u ON s.recorded_by_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (workerId) {
      params.push(workerId);
      query += ` AND s.worker_id = $${params.length}`;
    }

    if (month_year) {
      params.push(month_year);
      query += ` AND s.month_year = $${params.length}`;
    }

    query += ` ORDER BY s.payment_date DESC, s.id DESC`;

    const result = await pool.query(query, params);
    res.json({ settlements: result.rows });
  } catch (error: any) {
    console.error("Error fetching settlements:", error);
    res.status(500).json({ message: "पगार नोंदी लोड करताना त्रुटी आली", error: error.message });
  }
};
