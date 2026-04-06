/*
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                                      ║
 * ║  ███╗   ███╗ █████╗ ████████╗██╗  ██╗                                               ║
 * ║  ████╗ ████║██╔══██╗╚══██╔══╝██║  ██║                                               ║
 * ║  ██╔████╔██║███████║   ██║   ███████║                                               ║
 * ║  ██║╚██╔╝██║██╔══██║   ██║   ╚════██║                                               ║
 * ║  ██║ ╚═╝ ██║██║  ██║   ██║        ██║                                               ║
 * ║  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝        ╚═╝                                               ║
 * ║                                                                                      ║
 * ║  WakaPAC Unit — Mat4                                                                 ║
 * ║                                                                                      ║
 * ║  4×4 matrix math for WebGL components. All matrices are column-major                ║
 * ║  Float32Arrays, compatible with gl.uniformMatrix4fv().                              ║
 * ║                                                                                      ║
 * ║  Usage:                                                                              ║
 * ║    wakaPAC.use(Mat4);                                                                ║
 * ║                                                                                      ║
 * ║    // In a WebGL MSG_PAINT handler:                                                  ║
 * ║    const { mul, perspective, translation, rotX, rotY } = wakaPAC.unit(Mat4);        ║
 * ║    const mvp = mul(perspective(fov, aspect, near, far),                             ║
 * ║                mul(translation(0, 0, -4),                                           ║
 * ║                mul(rotX(rx), rotY(ry))));                                            ║
 * ║    gl.uniformMatrix4fv(uMVP, false, mvp);                                           ║
 * ║                                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════╝
 */
(function () {
    "use strict";

    window.Mat4 = {

        createPacPlugin(pac, options) {
            return {
                name: 'Mat4',

                functions: {

                    /**
                     * Returns a new 4×4 identity matrix.
                     * @returns {Float32Array}
                     */
                    identity() {
                        const m = new Float32Array(16);
                        m[0] = m[5] = m[10] = m[15] = 1;
                        return m;
                    },

                    /**
                     * Multiplies two 4×4 matrices: returns a × b.
                     * @param {Float32Array} a
                     * @param {Float32Array} b
                     * @returns {Float32Array}
                     */
                    mul(a, b) {
                        const o = new Float32Array(16);

                        for (let i = 0; i < 4; i++) {
                            for (let j = 0; j < 4; j++) {
                                let s = 0;

                                for (let k = 0; k < 4; k++) {
                                    s += a[i + k * 4] * b[k + j * 4];
                                }

                                o[i + j * 4] = s;
                            }
                        }

                        return o;
                    },

                    /**
                     * Returns a perspective projection matrix.
                     * @param {number} fovY   - Vertical field of view in radians
                     * @param {number} aspect - Viewport width / height
                     * @param {number} near   - Near clip plane distance
                     * @param {number} far    - Far clip plane distance
                     * @returns {Float32Array}
                     */
                    perspective(fovY, aspect, near, far) {
                        const f = 1 / Math.tan(fovY / 2);
                        const m = new Float32Array(16);
                        m[0] = f / aspect;
                        m[5] = f;
                        m[10] = (far + near) / (near - far);
                        m[11] = -1;
                        m[14] = (2 * far * near) / (near - far);
                        return m;
                    },

                    /**
                     * Returns a translation matrix.
                     * @param {number} x
                     * @param {number} y
                     * @param {number} z
                     * @returns {Float32Array}
                     */
                    translation(x, y, z) {
                        const m = new Float32Array(16);
                        m[0] = m[5] = m[10] = m[15] = 1;
                        m[12] = x;
                        m[13] = y;
                        m[14] = z;
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the X axis.
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotX(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);
                        m[0] = m[15] = 1;
                        m[5] = c;
                        m[6] = s;
                        m[9] = -s;
                        m[10] = c;
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the Y axis.
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotY(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);
                        m[5] = m[15] = 1;
                        m[0] = c;
                        m[2] = -s;
                        m[8] = s;
                        m[10] = c;
                        return m;
                    },

                    /**
                     * Returns a rotation matrix around the Z axis.
                     * @param {number} angle - Angle in radians
                     * @returns {Float32Array}
                     */
                    rotZ(angle) {
                        const m = new Float32Array(16);
                        const c = Math.cos(angle);
                        const s = Math.sin(angle);
                        m[10] = m[15] = 1;
                        m[0] = c;
                        m[1] = s;
                        m[4] = -s;
                        m[5] = c;
                        return m;
                    },

                    /**
                     * Returns a uniform scale matrix.
                     * @param {number} x
                     * @param {number} y
                     * @param {number} z
                     * @returns {Float32Array}
                     */
                    scale(x, y, z) {
                        const m = new Float32Array(16);
                        m[0] = x;
                        m[5] = y;
                        m[10] = z;
                        m[15] = 1;
                        return m;
                    },

                    /**
                     * Returns a look-at view matrix.
                     * @param {number[]} eye    - Camera position [x, y, z]
                     * @param {number[]} target - Look-at target [x, y, z]
                     * @param {number[]} up     - Up vector [x, y, z]
                     * @returns {Float32Array}
                     */
                    lookAt(eye, target, up) {
                        const normalize = v => {
                            const l = Math.hypot(...v);
                            return v.map(x => x / l);
                        };
                        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
                        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

                        const f = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
                        const r = normalize(cross(f, up));
                        const u = cross(r, f);

                        const m = new Float32Array(16);
                        m[0] = r[0];
                        m[1] = u[0];
                        m[2] = -f[0];
                        m[4] = r[1];
                        m[5] = u[1];
                        m[6] = -f[1];
                        m[8] = r[2];
                        m[9] = u[2];
                        m[10] = -f[2];
                        m[12] = -dot(r, eye);
                        m[13] = -dot(u, eye);
                        m[14] = dot(f, eye);
                        m[15] = 1;
                        return m;
                    },

                    /**
                     * Returns the transpose of a 4×4 matrix.
                     * @param {Float32Array} m
                     * @returns {Float32Array}
                     */
                    transpose(m) {
                        return new Float32Array([
                            m[0], m[4], m[8], m[12],
                            m[1], m[5], m[9], m[13],
                            m[2], m[6], m[10], m[14],
                            m[3], m[7], m[11], m[15],
                        ]);
                    },
                }
            };
        }
    };

})();