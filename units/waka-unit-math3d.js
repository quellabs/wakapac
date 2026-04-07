/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ███╗   ███╗ █████╗ ████████╗██╗  ██╗██████╗ ██████╗                                 ║
 * ║  ████╗ ████║██╔══██╗╚══██╔══╝██║  ██║╚════██╗██╔══██╗                                ║
 * ║  ██╔████╔██║███████║   ██║   ███████║ █████╔╝██║  ██║                                ║
 * ║  ██║╚██╔╝██║██╔══██║   ██║   ██╔══██║ ╚═══██╗██║  ██║                                ║
 * ║  ██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║██████╔╝██████╔╝                                ║
 * ║  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚═════╝                                 ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — Math3D                                                               ║
 * ║                                                                                      ║
 * ║  4×4 matrix math, vec3 utilities, and quaternion support for WebGL components.       ║
 * ║  All matrices are column-major Float32Arrays compatible with gl.uniformMatrix4fv().  ║
 * ║  Vectors are plain number arrays [x, y, z]. Quaternions are [x, y, z, w].            ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(Math3D);                                                              ║
 * ║    const m = wakaPAC.unit(Math3D);                                                   ║
 * ║                                                                                      ║
 * ║    // MVP matrix                                                                     ║
 * ║    const mvp = m.mul(m.perspective(fov, aspect, near, far),                          ║
 * ║                m.mul(m.translation(0, 0, -4),                                        ║
 * ║                m.mul(m.rotX(rx), m.rotY(ry))));                                      ║
 * ║    gl.uniformMatrix4fv(uMVP, false, mvp);                                            ║
 * ║                                                                                      ║
 * ║    // Normal matrix (for lighting)                                                   ║
 * ║    const normalMatrix = m.transpose(m.invert(modelMatrix));                          ║
 * ║    gl.uniformMatrix4fv(uNormal, false, normalMatrix);                                ║
 * ║                                                                                      ║
 * ║    // Smooth rotation via quaternion                                                 ║
 * ║    const q = m.quatSlerp(qA, qB, t);                                                 ║
 * ║    const rot = m.fromQuat(q);                                                        ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    window.Math3D = {

        /**
         * WakaPAC plugin factory. Called by wakaPAC.use(Math3D).
         * @param {object} _pac     - The WakaPAC instance
         * @param {object} _options - Plugin options (currently unused)
         * @returns {object} Plugin descriptor with name and functions
         */
        createPacPlugin(_pac, _options) {
            return {
                name: 'Math3D',

                functions: {

                    // ================================================================
                    // MAT4 — 4×4 matrix operations
                    //
                    // Stored as column-major Float32Arrays (16 elements), matching
                    // WebGL's expected layout for gl.uniformMatrix4fv().
                    //
                    // Column-major means element [col * 4 + row], so:
                    //   index  0  1  2  3   <- column 0 (X basis)
                    //          4  5  6  7   <- column 1 (Y basis)
                    //          8  9 10 11   <- column 2 (Z basis)
                    //         12 13 14 15   <- column 3 (translation / w)
                    // ================================================================

                    /**
                     * Returns a new 4×4 identity matrix.
                     * The identity is the neutral element for matrix multiplication:
                     * M × I = I × M = M.
                     * @returns {Float32Array}
                     */
                    identity() {
                        const m = new Float32Array(16); // all zeroes by default
                        m[0] = m[5] = m[10] = m[15] = 1; // set diagonal to 1
                        return m;
                    },

                    /**
                     * Multiplies two 4×4 matrices: returns a × b.
                     * Multiplication is not commutative — order matters.
                     * Transforms are applied right-to-left: mul(view, model) applies
                     * model first, then view.
                     * @param {Float32Array} a
                     * @param {Float32Array} b
                     * @returns {Float32Array}
                     */
                    mul(a, b) {
                        // Fully unrolled 4×4 matrix multiply.
                        // The loop version has two problems in hot paths:
                        //   1. Loop overhead (counter increments, branch checks) across 64 iterations.
                        //   2. b is accessed with stride 4 (b[k + j*4]), causing cache misses as k
                        //      walks non-contiguous memory. Unrolling lets the JIT hoist b's column
                        //      reads into locals (b0–b15), turning stride access into sequential reads
                        //      and exposing more parallelism to the engine.
                        //
                        // Each output element o[row + col*4] = dot(row of a, col of b).
                        // In column-major storage: row i of a = a[i], a[i+4], a[i+8], a[i+12].

                        // Cache a's elements as locals so each is read exactly once across all 4 output columns.
                        const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
                        const a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7];
                        const a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11];
                        const a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];

                        // Cache b's columns as locals — sequential reads, no stride.
                        const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];   // column 0
                        const b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];   // column 1
                        const b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11]; // column 2
                        const b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15]; // column 3

                        return new Float32Array([
                            // Column 0 of result
                            a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3,
                            a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3,
                            a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3,
                            a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3,
                            // Column 1 of result
                            a0 * b4 + a4 * b5 + a8 * b6 + a12 * b7,
                            a1 * b4 + a5 * b5 + a9 * b6 + a13 * b7,
                            a2 * b4 + a6 * b5 + a10 * b6 + a14 * b7,
                            a3 * b4 + a7 * b5 + a11 * b6 + a15 * b7,
                            // Column 2 of result
                            a0 * b8 + a4 * b9 + a8 * b10 + a12 * b11,
                            a1 * b8 + a5 * b9 + a9 * b10 + a13 * b11,
                            a2 * b8 + a6 * b9 + a10 * b10 + a14 * b11,
                            a3 * b8 + a7 * b9 + a11 * b10 + a15 * b11,
                            // Column 3 of result
                            a0 * b12 + a4 * b13 + a8 * b14 + a12 * b15,
                            a1 * b12 + a5 * b13 + a9 * b14 + a13 * b15,
                            a2 * b12 + a6 * b13 + a10 * b14 + a14 * b15,
                            a3 * b12 + a7 * b13 + a11 * b14 + a15 * b15,
                        ]);
                    },

                    /**
                     * Returns the inverse of a 4×4 matrix, or null if the matrix is singular.
                     * Required for computing normal matrices used in lighting calculations:
                     *   normalMatrix = transpose(invert(modelMatrix))
                     * The normal matrix corrects surface normals when a model has been
                     * non-uniformly scaled, so lighting remains accurate.
                     * @param {Float32Array} m
                     * @returns {Float32Array|null}
                     */
                    invert(m) {
                        const o = new Float32Array(16);

                        // Pre-compute the 12 "2×2 sub-determinants" (cofactor pairs) needed
                        // for the analytic 4×4 inverse formula. Each b_ij = m[r]*m[s] - m[t]*m[u]
                        // represents a minor of a 2×2 block within the matrix.

                        // Top-left 2×2 block minors (rows 0-1, cols 0-1):
                        const b00 = m[0] * m[5] - m[1] * m[4];
                        const b01 = m[0] * m[6] - m[2] * m[4];
                        const b02 = m[0] * m[7] - m[3] * m[4];
                        const b03 = m[1] * m[6] - m[2] * m[5];
                        const b04 = m[1] * m[7] - m[3] * m[5];
                        const b05 = m[2] * m[7] - m[3] * m[6];

                        // Bottom-right 2×2 block minors (rows 2-3, cols 2-3):
                        const b06 = m[8] * m[13] - m[9] * m[12];
                        const b07 = m[8] * m[14] - m[10] * m[12];
                        const b08 = m[8] * m[15] - m[11] * m[12];
                        const b09 = m[9] * m[14] - m[10] * m[13];
                        const b10 = m[9] * m[15] - m[11] * m[13];
                        const b11 = m[10] * m[15] - m[11] * m[14];

                        // The determinant of the full 4×4 matrix, expressed via the sub-determinants
                        // using the Leibniz formula / cofactor expansion.
                        const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

                        if (Math.abs(det) < 1e-10) {
                            return null; // Singular matrix — no inverse exists
                        }

                        // Multiply every adjugate entry by 1/det instead of dividing each
                        // individually — a single division is cheaper than sixteen.
                        const inv = 1 / det;

                        // Each output element is its cofactor (signed minor) divided by the
                        // determinant — the standard analytic formula for the 4×4 inverse.
                        o[0] = (m[5] * b11 - m[6] * b10 + m[7] * b09) * inv;
                        o[1] = (-m[1] * b11 + m[2] * b10 - m[3] * b09) * inv;
                        o[2] = (m[13] * b05 - m[14] * b04 + m[15] * b03) * inv;
                        o[3] = (-m[9] * b05 + m[10] * b04 - m[11] * b03) * inv;
                        o[4] = (-m[4] * b11 + m[6] * b08 - m[7] * b07) * inv;
                        o[5] = (m[0] * b11 - m[2] * b08 + m[3] * b07) * inv;
                        o[6] = (-m[12] * b05 + m[14] * b02 - m[15] * b01) * inv;
                        o[7] = (m[8] * b05 - m[10] * b02 + m[11] * b01) * inv;
                        o[8] = (m[4] * b10 - m[5] * b08 + m[7] * b06) * inv;
                        o[9] = (-m[0] * b10 + m[1] * b08 - m[3] * b06) * inv;
                        o[10] = (m[12] * b04 - m[13] * b02 + m[15] * b00) * inv;
                        o[11] = (-m[8] * b04 + m[9] * b02 - m[11] * b00) * inv;
                        o[12] = (-m[4] * b09 + m[5] * b07 - m[6] * b06) * inv;
                        o[13] = (m[0] * b09 - m[1] * b07 + m[2] * b06) * inv;
                        o[14] = (-m[12] * b03 + m[13] * b01 - m[14] * b00) * inv;
                        o[15] = (m[8] * b03 - m[9] * b01 + m[10] * b00) * inv;

                        return o;
                    },

                    /**
                     * Returns the transpose of a 4×4 matrix.
                     * Swaps rows and columns: element [r][c] becomes [c][r].
                     * Combined with invert(), produces the normal matrix for lighting:
                     *   normalMatrix = transpose(invert(modelMatrix))
                     * @param {Float32Array} m
                     * @returns {Float32Array}
                     */
                    transpose(m) {
                        // Rows and columns are exchanged: element at [row][col] moves to [col][row].
                        // Direct index assignment avoids the intermediate JS array literal that
                        // new Float32Array([...]) would otherwise allocate and immediately discard.
                        const o = new Float32Array(16);
                        o[0] = m[0];
                        o[1] = m[4];
                        o[2] = m[8];
                        o[3] = m[12];
                        o[4] = m[1];
                        o[5] = m[5];
                        o[6] = m[9];
                        o[7] = m[13];
                        o[8] = m[2];
                        o[9] = m[6];
                        o[10] = m[10];
                        o[11] = m[14];
                        o[12] = m[3];
                        o[13] = m[7];
                        o[14] = m[11];
                        o[15] = m[15];
                        return o;
                    },

                    /**
                     * Returns a perspective projection matrix.
                     * Maps the view frustum to NDC space, producing foreshortening so that
                     * objects farther from the camera appear smaller.
                     * @param {number} fovY   - Vertical field of view in radians
                     * @param {number} aspect - Viewport width / height
                     * @param {number} near   - Near clip plane distance (must be > 0)
                     * @param {number} far    - Far clip plane distance
                     * @returns {Float32Array}
                     */
                    perspective(fovY, aspect, near, far) {
                        // f = focal length: cot(fovY/2) — controls how "zoomed" the projection is.
                        const f = 1 / Math.tan(fovY / 2);
                        const m = new Float32Array(16); // zeroes by default; unset elements stay 0

                        m[0] = f / aspect;                         // X scale: narrows FOV horizontally
                        m[5] = f;                                  // Y scale: directly from FOV
                        m[10] = (far + near) / (near - far);       // maps Z to [-1, 1] NDC range
                        m[11] = -1;                                // perspective divide trigger (w = -z)
                        m[14] = (2 * far * near) / (near - far);   // Z translation for depth mapping
                        // m[15] stays 0 — w-component is filled by the perspective divide
                        return m;
                    },

                    /**
                     * Returns an orthographic projection matrix.
                     * All parallel lines remain parallel — no foreshortening.
                     * Useful for 2D overlays, UI elements, or isometric views.
                     * @param {number} left
                     * @param {number} right
                     * @param {number} bottom
                     * @param {number} top
                     * @param {number} near
                     * @param {number} far
                     * @returns {Float32Array}
                     */
                    ortho(left, right, bottom, top, near, far) {
                        const m = new Float32Array(16);

                        // Scale each axis so the specified box maps to [-1, 1] NDC.
                        m[0] = 2 / (right - left);               // X scale
                        m[5] = 2 / (top - bottom);               // Y scale
                        m[10] = -2 / (far - near);               // Z scale (negated: Z goes into screen)

                        // Translate the centre of the box to the NDC origin.
                        m[12] = -(right + left) / (right - left);  // X offset
                        m[13] = -(top + bottom) / (top - bottom);  // Y offset
                        m[14] = -(far + near) / (far - near);      // Z offset

                        m[15] = 1; // w stays 1 — no perspective divide
                        return m;
                    },

                    /**
                     * Returns a frustum projection matrix.
                     * Lower-level alternative to perspective() for asymmetric view frustums,
                     * e.g. VR or off-axis projections.
                     * @param {number} left
                     * @param {number} right
                     * @param {number} bottom
                     * @param {number} top
                     * @param {number} near
                     * @param {number} far
                     * @returns {Float32Array}
                     */
                    frustum(left, right, bottom, top, near, far) {
                        const m = new Float32Array(16);

                        // Pre-compute reciprocals to replace three divisions with multiplies
                        // in the assignments below.
                        const rl = 1 / (right - left);   // reciprocal of horizontal span
                        const tb = 1 / (top - bottom);   // reciprocal of vertical span
                        const nf = 1 / (near - far);     // reciprocal of depth span (negative)

                        m[0] = 2 * near * rl;              // X scale for the near plane
                        m[5] = 2 * near * tb;              // Y scale for the near plane
                        m[8] = (right + left) * rl;        // X shear (asymmetric frustum offset)
                        m[9] = (top + bottom) * tb;        // Y shear (asymmetric frustum offset)
                        m[10] = (far + near) * nf;         // Z mapping to NDC [-1, 1]
                        m[11] = -1;                        // perspective divide (w = -z)
                        m[14] = 2 * far * near * nf;       // Z translation for depth linearisation
                        return m;
                    },

                    /**
                     * Returns a translation matrix.
                     * Moves geometry by (x, y, z) in world space.
                     * @param {number} x
                     * @param {number} y
                     * @param {number} z
                     * @returns {Float32Array}
                     */
                    translation(x, y, z) {
                        const m = new Float32Array(16);

                        // identity diagonal
                        m[0] = m[5] = m[10] = m[15] = 1;

                        // Translation lives in the last column (indices 12–14) in column-major layout.
                        m[12] = x;
                        m[13] = y;
                        m[14] = z;
                        return m;
                    },

                    /**
                     * Returns a scale matrix.
                     * Scales geometry along each axis independently.
                     * Uniform scale (x = y = z) preserves shape; non-uniform scale changes normals
                     * and requires a normal matrix correction in shaders.
                     * @param {number} x
                     * @param {number} y
                     * @param {number} z
                     * @returns {Float32Array}
                     */
                    scale(x, y, z) {
                        const m = new Float32Array(16);

                        // Scale factors sit on the diagonal; all off-diagonal entries stay 0.
                        m[0] = x;
                        m[5] = y;
                        m[10] = z;

                        // w must be 1 to preserve homogeneous coordinates
                        m[15] = 1;
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the X axis.
                     * Rotates the Y axis toward the Z axis (right-hand rule).
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotX(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);

                        // X and W components are unchanged
                        m[0] = m[15] = 1;

                        // 2×2 rotation block in the Y-Z plane (column-major indices):
                        m[5] = c;  // [1][1]
                        m[6] = s;  // [2][1]
                        m[9] = -s;  // [1][2]
                        m[10] = c;  // [2][2]
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the Y axis.
                     * Rotates the Z axis toward the X axis (right-hand rule).
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotY(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);

                        // Y and W components are unchanged
                        m[5] = m[15] = 1;

                        // 2×2 rotation block in the X-Z plane (column-major indices):
                        m[0] = c;  // [0][0]
                        m[2] = -s;  // [2][0] — note sign flip vs rotX; Z-to-X rotation
                        m[8] = s;  // [0][2]
                        m[10] = c;  // [2][2]
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the Z axis.
                     * Rotates the X axis toward the Y axis (right-hand rule).
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotZ(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);

                        m[10] = m[15] = 1; // Z and W components are unchanged

                        // 2×2 rotation block in the X-Y plane (column-major indices):
                        m[0] = c;  // [0][0]
                        m[1] = s;  // [1][0]
                        m[4] = -s;  // [0][1]
                        m[5] = c;  // [1][1]
                        return m;
                    },

                    /**
                     * Returns a look-at view matrix.
                     * Builds an orthonormal camera basis from eye position, target, and up hint,
                     * then computes the view matrix that transforms world space into camera space.
                     * @param {number[]} eye    - Camera position [x, y, z]
                     * @param {number[]} target - Look-at target [x, y, z]
                     * @param {number[]} up     - Up vector [x, y, z], typically [0, 1, 0]
                     * @returns {Float32Array}
                     */
                    lookAt(eye, target, up) {
                        // f = forward direction: normalised vector from eye toward target.
                        const f = this.vec3Normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);

                        // r = right direction: perpendicular to both forward and the up hint.
                        // cross(f, up) gives a vector pointing to the camera's right.
                        const r = this.vec3Normalize(this.vec3Cross(f, up));

                        // u = true up direction: recomputed from r and f to guarantee orthogonality.
                        // The original `up` hint may not be perpendicular to f.
                        const u = this.vec3Cross(r, f);

                        // Build the view matrix.
                        // The rotation part is the camera basis transposed (inverse of pure rotation).
                        // The translation part is -dot(basis, eye), moving the world so the camera is at origin.
                        const m = new Float32Array(16);

                        // Column 0: right vector
                        m[0] = r[0];
                        m[1] = u[0];
                        m[2] = -f[0];

                        // Column 1: up vector
                        m[4] = r[1];
                        m[5] = u[1];
                        m[6] = -f[1];

                        // Column 2: negated forward (-f puts +Z behind the camera, matching OpenGL convention)
                        m[8] = r[2];
                        m[9] = u[2];
                        m[10] = -f[2];

                        // Column 3: translation that repositions world relative to the camera
                        m[12] = -this.vec3Dot(r, eye);
                        m[13] = -this.vec3Dot(u, eye);
                        m[14] = this.vec3Dot(f, eye); // positive because forward was negated above
                        m[15] = 1;
                        return m;
                    },

                    /**
                     * Returns a rotation matrix from a unit quaternion [x, y, z, w].
                     * Converts a quaternion (e.g. from quatSlerp()) to the 4×4 column-major
                     * rotation matrix expected by WebGL.
                     * @param {number[]} q - Unit quaternion [x, y, z, w]
                     * @returns {Float32Array}
                     */
                    fromQuat(q) {
                        const [x, y, z, w] = q;

                        // Pre-compute doubled components to halve the number of multiplications.
                        // Each product x*x2 is equivalent to 2*x*x (i.e. 2x²), as used in the
                        // standard quaternion-to-matrix formula.
                        const x2 = x + x, y2 = y + y, z2 = z + z;
                        const xx = x * x2, yx = y * x2, yy = y * y2; // 2x², 2xy, 2y²
                        const zx = z * x2, zy = z * y2, zz = z * z2; // 2xz, 2yz, 2z²
                        const wx = w * x2, wy = w * y2, wz = w * z2; // 2wx, 2wy, 2wz

                        const m = new Float32Array(16);
                        // Diagonal: 1 - 2(y²+z²), 1 - 2(x²+z²), 1 - 2(x²+y²)
                        m[0] = 1 - yy - zz;  // column 0, row 0
                        m[1] = yx + wz;      // column 0, row 1
                        m[2] = zx - wy;      // column 0, row 2
                        m[4] = yx - wz;      // column 1, row 0
                        m[5] = 1 - xx - zz;  // column 1, row 1
                        m[6] = zy + wx;      // column 1, row 2
                        m[8] = zx + wy;      // column 2, row 0
                        m[9] = zy - wx;      // column 2, row 1
                        m[10] = 1 - xx - yy;  // column 2, row 2
                        m[15] = 1;            // w = 1 (pure rotation, no translation)
                        return m;
                    },

                    // ================================================================
                    // VEC3 — 3-component vector operations
                    // Vectors are plain number arrays [x, y, z].
                    // Used internally by lookAt() and available to consuming components.
                    // ================================================================

                    /**
                     * Adds two vec3s: returns a + b.
                     * @param {number[]} a
                     * @param {number[]} b
                     * @returns {number[]}
                     */
                    vec3Add(a, b) {
                        return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
                    },

                    /**
                     * Subtracts two vec3s: returns a - b.
                     * @param {number[]} a
                     * @param {number[]} b
                     * @returns {number[]}
                     */
                    vec3Subtract(a, b) {
                        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
                    },

                    /**
                     * Scales a vec3 by a scalar.
                     * @param {number[]} v
                     * @param {number}   s
                     * @returns {number[]}
                     */
                    vec3Scale(v, s) {
                        return [v[0] * s, v[1] * s, v[2] * s];
                    },

                    /**
                     * Returns the dot product of two vec3s.
                     * Geometrically: |a| * |b| * cos(θ), where θ is the angle between them.
                     * Returns 0 for perpendicular vectors, positive if they point in the same
                     * general direction, negative if opposite.
                     * @param {number[]} a
                     * @param {number[]} b
                     * @returns {number}
                     */
                    vec3Dot(a, b) {
                        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
                    },

                    /**
                     * Returns the cross product of two vec3s: a × b.
                     * The result is perpendicular to both input vectors.
                     * Magnitude equals |a| * |b| * sin(θ); direction follows the right-hand rule.
                     * Used internally by lookAt() to build an orthonormal camera basis.
                     * @param {number[]} a
                     * @param {number[]} b
                     * @returns {number[]}
                     */
                    vec3Cross(a, b) {
                        return [
                            a[1] * b[2] - a[2] * b[1], // x =  ay*bz - az*by
                            a[2] * b[0] - a[0] * b[2], // y =  az*bx - ax*bz
                            a[0] * b[1] - a[1] * b[0], // z =  ax*by - ay*bx
                        ];
                    },

                    /**
                     * Returns the Euclidean length of a vec3.
                     * Uses Math.hypot for numerical stability (avoids overflow for large components).
                     * @param {number[]} v
                     * @returns {number}
                     */
                    vec3Length(v) {
                        return Math.hypot(v[0], v[1], v[2]);
                    },

                    /**
                     * Returns the unit-length version of a vec3.
                     * Divides each component by the vector's length.
                     * Returns [0, 0, 0] if the input has zero length to avoid NaN propagation.
                     * @param {number[]} v
                     * @returns {number[]}
                     */
                    vec3Normalize(v) {
                        const l = Math.hypot(v[0], v[1], v[2]);

                        if (l < 1e-10) {
                            return [0, 0, 0]; // degenerate vector — return zero rather than NaN
                        }

                        return [v[0] / l, v[1] / l, v[2] / l];
                    },

                    /**
                     * Linearly interpolates between two vec3s.
                     * At t=0 returns a; at t=1 returns b.
                     * Values outside [0, 1] extrapolate beyond the endpoints.
                     * @param {number[]} a - Start vector
                     * @param {number[]} b - End vector
                     * @param {number}   t - Interpolation factor [0, 1]
                     * @returns {number[]}
                     */
                    vec3Lerp(a, b, t) {
                        // Written as a + (b-a)*t rather than a*(1-t) + b*t to minimise
                        // floating-point error when t is close to 0 (stays near a exactly).
                        return [
                            a[0] + (b[0] - a[0]) * t,
                            a[1] + (b[1] - a[1]) * t,
                            a[2] + (b[2] - a[2]) * t,
                        ];
                    },

                    // ================================================================
                    // QUAT — quaternion operations
                    //
                    // Quaternions are plain number arrays [x, y, z, w], where (x, y, z)
                    // is the imaginary vector part and w is the real scalar part.
                    // A unit quaternion (|q| = 1) represents a 3D rotation without the
                    // gimbal-lock issues of Euler angles.
                    // ================================================================

                    /**
                     * Returns an identity quaternion [0, 0, 0, 1].
                     * Represents the "no rotation" state; equivalent to the identity matrix.
                     * @returns {number[]}
                     */
                    quatIdentity() {
                        return [0, 0, 0, 1]; // w=1, xyz=0 → zero rotation angle
                    },

                    /**
                     * Returns a quaternion from Euler angles (applied in X → Y → Z order).
                     * Constructs individual half-angle sin/cos values for each axis then
                     * combines them into a single quaternion product (XYZ order).
                     * @param {number} x - Rotation around X in radians
                     * @param {number} y - Rotation around Y in radians
                     * @param {number} z - Rotation around Z in radians
                     * @returns {number[]}
                     */
                    quatFromEuler(x, y, z) {
                        // A quaternion for angle θ around axis n is [n*sin(θ/2), cos(θ/2)].
                        // Pre-compute the half-angle trig values for all three axes.
                        const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
                        const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
                        const cz = Math.cos(z / 2), sz = Math.sin(z / 2);

                        // The result is the quaternion product qZ * qY * qX (XYZ intrinsic order).
                        // Expanded algebraically to avoid building and multiplying three separate quaternions.
                        return [
                            sx * cy * cz + cx * sy * sz, // x component
                            cx * sy * cz - sx * cy * sz, // y component
                            cx * cy * sz + sx * sy * cz, // z component
                            cx * cy * cz - sx * sy * sz, // w component
                        ];
                    },

                    /**
                     * Returns a quaternion representing a rotation of `angle` radians
                     * around the given axis vector.
                     * The axis does not need to be unit length — it is normalised internally.
                     * @param {number[]} axis  - Rotation axis [x, y, z] (need not be unit length)
                     * @param {number}   angle - Angle in radians
                     * @returns {number[]}
                     */
                    quatFromAxisAngle(axis, angle) {
                        // Normalise the axis while computing the sine scale factor in one step.
                        // Guard against zero-length axis by falling back to divisor 1 (result will be ~0 anyway).
                        const l = Math.hypot(axis[0], axis[1], axis[2]);
                        const s = Math.sin(angle / 2) / (l < 1e-10 ? 1 : l);

                        return [
                            axis[0] * s,            // x = nx * sin(θ/2)
                            axis[1] * s,            // y = ny * sin(θ/2)
                            axis[2] * s,            // z = nz * sin(θ/2)
                            Math.cos(angle / 2), // w = cos(θ/2)
                        ];
                    },

                    /**
                     * Multiplies two quaternions: returns a × b.
                     * Equivalent to applying rotation b followed by rotation a (same
                     * right-to-left convention as matrix multiplication).
                     * @param {number[]} a
                     * @param {number[]} b
                     * @returns {number[]}
                     */
                    quatMul(a, b) {
                        // Hamilton product. Expands (a.w + a.xi + a.yj + a.zk)(b.w + b.xi + b.yj + b.zk)
                        // using ij=k, jk=i, ki=j, ii=jj=kk=-1.
                        return [
                            a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], // x
                            a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], // y
                            a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], // z
                            a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2], // w
                        ];
                    },

                    /**
                     * Returns the normalized version of a quaternion.
                     * Ensures unit length, which is required for a quaternion to represent
                     * a pure rotation. Floating-point drift from repeated multiplications
                     * can make a quaternion non-unit over time; call this to re-normalise.
                     * Returns the identity quaternion [0,0,0,1] for near-zero input.
                     * @param {number[]} q
                     * @returns {number[]}
                     */
                    quatNormalize(q) {
                        const l = Math.hypot(q[0], q[1], q[2], q[3]);

                        if (l < 1e-10) {
                            return [0, 0, 0, 1]; // degenerate quaternion — return identity
                        }

                        return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
                    },

                    /**
                     * Spherically interpolates between two quaternions.
                     * Produces smooth, constant-speed rotation — unlike lerping Euler
                     * angles, slerp avoids gimbal lock and uneven angular speed.
                     * Both input quaternions should be unit length.
                     * @param {number[]} a - Start quaternion (unit length)
                     * @param {number[]} b - End quaternion (unit length)
                     * @param {number}   t - Interpolation factor [0, 1]
                     * @returns {number[]}
                     */
                    quatSlerp(a, b, t) {
                        // The dot product of two unit quaternions equals cos(θ/2), where θ is
                        // the angular difference between the rotations they represent.
                        let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

                        // Two quaternions represent the same rotation if they are identical OR
                        // negations of each other (q and -q map to the same orientation).
                        // If dot < 0 the quaternions are on opposite hemispheres; negate b so
                        // the interpolation travels the shorter arc rather than the long way around.
                        let bx = b[0], by = b[1], bz = b[2], bw = b[3];

                        if (dot < 0) {
                            dot = -dot;
                            bx = -bx;
                            by = -by;
                            bz = -bz;
                            bw = -bw;
                        }

                        // When the quaternions are nearly identical (dot ≈ 1, θ ≈ 0), sin(θ) → 0
                        // and the slerp formula would divide by zero. Fall back to normalised
                        // linear interpolation (nlerp), which is equivalent for tiny angles.
                        // The inputs are already unit quaternions and t ∈ [0,1], so the lerp
                        // result has length very close to 1. Inline to avoid allocating a temporary
                        // array that quatNormalize() would require.
                        if (dot > 0.9995) {
                            const lx = a[0] + t * (bx - a[0]);
                            const ly = a[1] + t * (by - a[1]);
                            const lz = a[2] + t * (bz - a[2]);
                            const lw = a[3] + t * (bw - a[3]);
                            const ll = Math.hypot(lx, ly, lz, lw);

                            // ll will be extremely close to 1, but normalise anyway for
                            // correctness when this path is hit repeatedly (accumulated drift).
                            return [lx / ll, ly / ll, lz / ll, lw / ll];
                        }

                        // Standard slerp formula: result = sin((1-t)*θ)/sin(θ) * a + sin(t*θ)/sin(θ) * b
                        const theta0 = Math.acos(dot);    // total angle between a and b
                        const theta = theta0 * t;        // angle to the interpolated point
                        const sinT0 = Math.sin(theta0);  // denominator shared by both scale factors
                        const sinT = Math.sin(theta);

                        // Rewritten to avoid a second acos/sin call for the (1-t) term:
                        //   s1 = sin((1-t)*θ) / sin(θ) = cos(t*θ) - cos(θ) * sin(t*θ) / sin(θ)
                        const s1 = Math.cos(theta) - dot * sinT / sinT0;
                        const s2 = sinT / sinT0; // sin(t*θ) / sin(θ)

                        return [
                            s1 * a[0] + s2 * bx,
                            s1 * a[1] + s2 * by,
                            s1 * a[2] + s2 * bz,
                            s1 * a[3] + s2 * bw,
                        ];
                    },
                }
            };
        }
    };

})();