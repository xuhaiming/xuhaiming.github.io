import { useIsMobile } from "@/hooks/use-mobile";
import React, { useRef, useEffect, useState } from "react";

// SVG Paths for Haiming and Pages logos
const HAIMING_LOGO_PATH =
  "M 294 99.6 L 294 100.6 Q 291.2 101 287.75 101 Q 285.272 101 281.969 100.226 A 48.101 48.101 0 0 1 279.25 99.5 A 20.894 20.894 0 0 1 271.671 95.346 A 25.373 25.373 0 0 1 270.1 93.9 A 34.912 34.912 0 0 1 261.106 78.107 A 45.865 45.865 0 0 1 259.9 72.1 L 253.8 27.6 L 233 74.6 Q 230.264 80.561 229.629 84.612 A 18.545 18.545 0 0 0 229.6 84.8 L 228.6 84.8 L 202.7 28.5 L 198.3 78.2 Q 198.1 79.9 199.35 81.2 A 4.855 4.855 0 0 0 200.281 81.967 A 3.39 3.39 0 0 0 202.1 82.5 L 203.7 82.5 L 203.7 83.4 L 184.3 83.4 L 184.3 82.4 L 185.9 82.4 Q 188.6 82.4 190.65 80.75 Q 192.7 79.1 193.2 76.4 L 199.5 21.8 Q 194.972 12.899 189.518 8.577 A 17.554 17.554 0 0 0 178.4 4.5 A 26.803 26.803 0 0 0 176.694 4.556 A 30.693 30.693 0 0 0 176.1 4.6 L 176.1 3.6 A 29.901 29.901 0 0 1 177.69 3.231 Q 179.263 2.914 180.402 2.901 A 8.466 8.466 0 0 1 180.5 2.9 A 44.578 44.578 0 0 1 182.507 2.948 A 57.068 57.068 0 0 1 184.2 3.05 A 16.59 16.59 0 0 1 185.798 3.254 Q 187.213 3.5 188.9 4 Q 191.6 4.8 194 6.35 A 34.892 34.892 0 0 1 196.51 8.126 A 27.554 27.554 0 0 1 198.2 9.55 Q 200 11.2 201.6 13.2 A 49.736 49.736 0 0 1 204.021 16.718 A 36.553 36.553 0 0 1 205.9 20.1 L 230 72.3 L 256.9 12 L 257.8 12 L 267.1 71.2 Q 268.583 81.085 272.483 87.58 A 26.688 26.688 0 0 0 276.15 92.4 A 23.558 23.558 0 0 0 284.048 97.911 A 22.52 22.52 0 0 0 292.8 99.6 L 294 99.6 Z M 418.2 97.6 L 418.6 98.6 A 35.305 35.305 0 0 1 413.871 99.743 Q 408.832 100.582 404.514 99.576 A 20.003 20.003 0 0 1 404.2 99.5 A 34.87 34.87 0 0 1 396.878 96.658 A 29.602 29.602 0 0 1 392.6 93.9 A 81.604 81.604 0 0 1 387.324 89.223 A 106.506 106.506 0 0 1 383 84.8 L 330.3 26.4 L 330.3 76.4 A 6.544 6.544 0 0 0 330.792 78.794 Q 331.461 80.367 333.033 81.379 A 7.597 7.597 0 0 0 333.4 81.6 Q 334.8 82.4 336.4 82.4 L 338.3 82.4 L 338.3 83.4 L 317.7 83.4 L 317.7 82.4 L 319.6 82.4 Q 322.1 82.4 323.9 80.65 A 5.797 5.797 0 0 0 325.698 76.462 A 7.397 7.397 0 0 0 325.7 76.3 L 325.7 21.4 A 30.415 30.415 0 0 0 325.411 21.003 Q 324.98 20.421 324.206 19.41 A 331.124 331.124 0 0 0 323.7 18.75 Q 322.2 16.8 321.2 15.6 Q 320.2 14.4 318.5 12.45 A 37.365 37.365 0 0 0 317.26 11.093 Q 316.633 10.441 316.043 9.904 A 19.158 19.158 0 0 0 315.35 9.3 A 407.897 407.897 0 0 1 313.995 8.174 Q 313.3 7.594 312.525 6.942 A 727.824 727.824 0 0 1 312 6.5 A 19.871 19.871 0 0 0 306.861 3.621 A 18.487 18.487 0 0 0 305.6 3.2 Q 303.211 2.498 301.34 2.289 A 13.462 13.462 0 0 0 299.85 2.2 Q 297.5 2.2 294.8 3 L 294.4 2 A 27.104 27.104 0 0 1 299.257 0.469 A 21.368 21.368 0 0 1 303.65 0 Q 307.438 0 310.32 0.761 A 17.326 17.326 0 0 1 311.3 1.05 A 19.577 19.577 0 0 1 314.182 2.278 Q 315.569 2.995 317.038 3.984 A 37.612 37.612 0 0 1 318.2 4.8 Q 321.033 6.867 323.074 8.7 A 37.427 37.427 0 0 1 324.25 9.8 Q 325.847 11.363 327.883 13.573 A 186.493 186.493 0 0 1 329.9 15.8 L 380.3 71.8 L 380.3 20.5 Q 380.2 17.9 378.4 16.15 Q 376.6 14.4 374.1 14.4 L 372.2 14.4 L 372.2 13.4 L 392.8 13.4 L 392.8 14.4 L 391 14.4 Q 388.5 14.4 386.7 16.15 Q 384.9 17.9 384.8 20.4 L 384.8 76.9 Q 385.8 78 387.65 80.2 A 2508.829 2508.829 0 0 1 388.506 81.219 Q 389.563 82.477 390.124 83.15 A 252.862 252.862 0 0 1 390.25 83.3 Q 390.824 83.989 391.838 85.147 A 260.618 260.618 0 0 0 392.5 85.9 A 53.856 53.856 0 0 0 393.394 86.889 Q 394.313 87.881 395.027 88.529 A 15.966 15.966 0 0 0 395.05 88.55 Q 396.1 89.5 397.65 90.95 Q 398.976 92.191 400.156 92.992 A 13.555 13.555 0 0 0 400.55 93.25 A 243.69 243.69 0 0 1 401.893 94.102 Q 402.596 94.552 403.376 95.055 A 406.996 406.996 0 0 1 403.6 95.2 A 18.316 18.316 0 0 0 407.296 96.823 A 22.153 22.153 0 0 0 409.05 97.3 Q 412.066 97.992 414.007 98 A 10.954 10.954 0 0 0 414.05 98 A 21.522 21.522 0 0 0 416.585 97.844 A 26.476 26.476 0 0 0 418.2 97.6 Z M 464.5 18.8 L 466.5 32.9 L 465.6 32.9 A 24.954 24.954 0 0 0 462.097 24.967 A 21.471 21.471 0 0 0 452 17.1 A 28.516 28.516 0 0 0 445.001 15.302 A 36.926 36.926 0 0 0 440.2 15 A 31.769 31.769 0 0 0 428.013 17.277 A 29.656 29.656 0 0 0 417.75 24.4 Q 408.8 33.8 408.8 48.25 Q 408.8 62.7 417.8 72.2 A 29.814 29.814 0 0 0 439.367 81.785 A 37.509 37.509 0 0 0 440.2 81.8 Q 446.7 81.8 452.6 79.5 A 30.696 30.696 0 0 0 460.203 75.264 A 27.922 27.922 0 0 0 462.7 73.1 L 462.7 55.4 Q 462.7 53.581 461.811 52.48 A 3.549 3.549 0 0 0 461.4 52.05 Q 460.1 50.9 457.7 50.9 L 456.1 50.9 L 456.1 49.9 L 475.7 49.9 L 475.7 50.9 L 474.2 50.9 A 8.684 8.684 0 0 0 472.755 51.012 Q 471.984 51.143 471.372 51.424 A 3.933 3.933 0 0 0 470.4 52.05 Q 469.193 53.118 469.193 55.091 A 6.804 6.804 0 0 0 469.2 55.4 L 469.2 70.8 Q 469.8 86.6 479.5 93.4 A 24.877 24.877 0 0 0 487.854 97.145 Q 491.253 98.002 495.232 98.163 A 46.294 46.294 0 0 0 497.1 98.2 Q 501.6 98.2 506.9 97.3 L 507 98.3 A 59.188 59.188 0 0 1 499.764 100.095 Q 495.82 100.799 492.214 100.8 A 35.568 35.568 0 0 1 492.2 100.8 A 32.544 32.544 0 0 1 482.303 99.359 A 26.613 26.613 0 0 1 471.4 92.7 A 28.52 28.52 0 0 1 464.194 80.368 A 35.267 35.267 0 0 1 463.5 77.6 A 35.136 35.136 0 0 1 447.277 84.285 A 46.977 46.977 0 0 1 440.2 84.8 A 43.272 43.272 0 0 1 426.284 82.606 A 39.686 39.686 0 0 1 420.35 80.05 Q 411.4 75.3 406.35 67 A 34.927 34.927 0 0 1 401.325 49.752 A 41.951 41.951 0 0 1 401.3 48.3 A 36.773 36.773 0 0 1 403.58 35.251 A 34.377 34.377 0 0 1 406.35 29.55 Q 411.4 21.2 420.3 16.6 A 41.56 41.56 0 0 1 436.481 12.136 A 50.176 50.176 0 0 1 440.2 12 Q 454 12 464.5 18.8 Z M 66.9 82.4 L 68.1 82.4 L 68.1 83.4 L 46.3 83.4 L 46.3 82.4 L 47.6 82.4 Q 50.1 82.4 51.95 80.65 Q 53.8 78.9 54 76.3 L 54 50.3 L 15.3 50.3 L 15.3 76.4 Q 15.3 88.947 9.839 94.104 A 12.166 12.166 0 0 1 8.5 95.2 Q 5.4 97.4 0.5 98.5 L 0 97.6 A 14.508 14.508 0 0 0 6.408 90.739 A 18.198 18.198 0 0 0 6.65 90.2 A 22.015 22.015 0 0 0 7.874 86.314 Q 8.786 82.24 8.8 76.58 A 71.578 71.578 0 0 0 8.8 76.4 L 8.8 20.6 A 5.811 5.811 0 0 0 7.031 16.328 A 7.14 7.14 0 0 0 6.9 16.2 Q 5 14.4 2.4 14.4 L 1.2 14.4 L 1.2 13.4 L 23 13.4 L 23 14.4 L 21.7 14.4 Q 19.1 14.4 17.25 16.2 Q 15.4 18 15.3 20.6 L 15.3 47.3 L 54 47.3 L 54 22.4 Q 54.1 9.6 59.7 4.6 Q 63.1 1.6 68.9 0.3 L 69.4 1.2 A 14.725 14.725 0 0 0 62.985 7.984 A 18.473 18.473 0 0 0 62.7 8.6 Q 60.523 13.549 60.5 22.22 A 69.968 69.968 0 0 0 60.5 22.4 L 60.5 76.1 A 6.059 6.059 0 0 0 62.293 80.492 A 7.395 7.395 0 0 0 62.35 80.55 A 6.172 6.172 0 0 0 66.816 82.4 A 7.824 7.824 0 0 0 66.9 82.4 Z M 87.4 11 L 87.1 10 A 36.838 36.838 0 0 1 93.67 7.934 A 28.87 28.87 0 0 1 99.6 7.3 Q 104.6 7.3 109.9 11 Q 112.8 13 116.4 18.8 Q 118.8 22.8 122.5 33.3 L 134.7 67.9 Q 137.608 75.932 140.588 81.686 A 61.271 61.271 0 0 0 143.25 86.35 A 91.067 91.067 0 0 0 145.896 90.299 Q 148.537 94.014 150.87 96.328 A 26.723 26.723 0 0 0 151.2 96.65 A 25.042 25.042 0 0 0 154.641 99.434 A 18.783 18.783 0 0 0 158.7 101.5 A 32.533 32.533 0 0 0 161.006 102.238 Q 163.317 102.878 165.033 102.899 A 9.458 9.458 0 0 0 165.15 102.9 Q 167.531 102.9 169.432 102.552 A 17.015 17.015 0 0 0 169.7 102.5 L 169.8 103.5 A 31.019 31.019 0 0 1 163.313 104.942 A 27.135 27.135 0 0 1 160.4 105.1 Q 155.8 105.1 151.2 102.75 A 30.482 30.482 0 0 1 144.897 98.416 A 36.859 36.859 0 0 1 142.6 96.2 A 45.607 45.607 0 0 1 136.516 88.395 Q 131.75 80.825 128 69.7 L 124.1 58.3 L 96.7 58.3 L 89.8 76.1 A 6.423 6.423 0 0 0 89.342 77.806 A 5.797 5.797 0 0 0 89.3 78.5 A 3.184 3.184 0 0 0 89.523 79.638 Q 89.686 80.066 89.968 80.51 A 6.936 6.936 0 0 0 90.35 81.05 Q 91.353 82.339 93.405 82.397 A 6.923 6.923 0 0 0 93.6 82.4 L 94.4 82.4 L 94.4 83.4 L 74.3 83.4 L 74.3 82.4 L 75.2 82.4 Q 77.6 82.4 79.9 80.95 Q 82.2 79.5 83.7 76.6 L 108.5 17.2 A 21.315 21.315 0 0 0 104.676 12.976 A 14.607 14.607 0 0 0 95.1 9.5 A 19.799 19.799 0 0 0 90.894 9.974 A 26.661 26.661 0 0 0 87.4 11 Z M 175.6 82.4 L 176.9 82.4 L 176.9 83.4 L 155 83.4 L 155 82.4 L 156.3 82.4 Q 158.9 82.4 160.8 80.55 A 6.204 6.204 0 0 0 162.323 78.267 A 6.145 6.145 0 0 0 162.7 76.1 L 162.7 16.1 L 152 16.7 Q 141.9 17.3 141.9 24 Q 141.9 26.7 143.65 28.6 A 5.713 5.713 0 0 0 145.72 29.999 Q 146.579 30.352 147.645 30.533 A 13.558 13.558 0 0 0 149.2 30.7 L 149.2 31.3 Q 147.8 31.6 146.4 31.6 A 8.711 8.711 0 0 1 143.536 31.153 Q 141.223 30.352 139.811 28.118 A 9.125 9.125 0 0 1 139.8 28.1 Q 138.5 26.1 138.5 23.7 Q 138.5 15.2 151.4 13.8 Q 151.487 13.8 158.951 13.308 A 24218.738 24218.738 0 0 0 161.35 13.15 Q 170.486 12.547 176.052 11.557 A 59.077 59.077 0 0 0 176.9 11.4 L 177.1 12.4 Q 172.8 13.1 171 15.3 Q 169.481 17.156 169.244 20.223 A 15.265 15.265 0 0 0 169.2 21.4 L 169.2 76.1 Q 169.3 78.7 171.15 80.55 A 6.06 6.06 0 0 0 175.519 82.4 A 7.26 7.26 0 0 0 175.6 82.4 Z M 308 82.4 L 309.3 82.4 L 309.3 83.4 L 287.4 83.4 L 287.4 82.4 L 288.7 82.4 Q 291.3 82.4 293.2 80.55 A 6.204 6.204 0 0 0 294.723 78.267 A 6.145 6.145 0 0 0 295.1 76.1 L 295.1 16.1 L 284.4 16.7 Q 274.3 17.3 274.3 24 Q 274.3 26.7 276.05 28.6 A 5.713 5.713 0 0 0 278.12 29.999 Q 278.979 30.352 280.045 30.533 A 13.558 13.558 0 0 0 281.6 30.7 L 281.6 31.3 Q 280.2 31.6 278.8 31.6 A 8.711 8.711 0 0 1 275.936 31.153 Q 273.623 30.352 272.211 28.118 A 9.125 9.125 0 0 1 272.2 28.1 Q 270.9 26.1 270.9 23.7 Q 270.9 15.2 283.8 13.8 Q 283.887 13.8 291.351 13.308 A 24218.738 24218.738 0 0 0 293.75 13.15 Q 302.886 12.547 308.452 11.557 A 59.077 59.077 0 0 0 309.3 11.4 L 309.5 12.4 Q 305.2 13.1 303.4 15.3 Q 301.881 17.156 301.644 20.223 A 15.265 15.265 0 0 0 301.6 21.4 L 301.6 76.1 Q 301.7 78.7 303.55 80.55 A 6.06 6.06 0 0 0 307.919 82.4 A 7.26 7.26 0 0 0 308 82.4 Z M 111 21.5 L 97.8 55.3 L 123.1 55.3 L 115.2 32 A 146.287 146.287 0 0 0 113.802 28.096 Q 112.306 24.113 111 21.5 Z";

const PAGES_LOGO_PATH =
  "M 83.1 86.2 L 84.5 86.2 L 84.5 87.2 L 60.1 87.2 L 60.1 86.2 L 61.3 86.2 A 3.816 3.816 0 0 0 63.116 85.775 Q 63.87 85.375 64.436 84.599 A 5.328 5.328 0 0 0 64.7 84.2 A 5.215 5.215 0 0 0 65.127 83.389 Q 65.33 82.896 65.382 82.425 A 2.943 2.943 0 0 0 65.4 82.1 A 4.257 4.257 0 0 0 65.107 80.569 A 5.227 5.227 0 0 0 64.9 80.1 L 49.5 55.8 L 30.2 84.1 A 75.999 75.999 0 0 1 25.376 90.439 Q 20.759 95.847 16.1 98.8 Q 10.4 102.3 3.6 102.3 Q 1.8 102.3 0 102.1 L 0 101.1 A 19.726 19.726 0 0 0 10.646 97.38 A 25.861 25.861 0 0 0 12.9 95.6 A 61.198 61.198 0 0 0 18.955 89.272 A 75.821 75.821 0 0 0 22.4 84.8 Q 23.229 83.787 24.906 81.417 A 197.698 197.698 0 0 0 25.2 81 L 46.4 51 L 29.4 24.1 A 14.361 14.361 0 0 0 25.121 19.951 A 13.914 13.914 0 0 0 23.3 19 Q 21.3 18.2 19.3 18.2 L 17.9 18.2 L 17.9 17.2 L 42.1 17.2 L 42.1 18.2 L 40.9 18.2 A 3.515 3.515 0 0 0 39.198 18.652 A 4.955 4.955 0 0 0 38.4 19.2 Q 35.926 21.278 37.271 24.237 A 6.866 6.866 0 0 0 37.3 24.3 L 50.8 45.5 L 70 18.2 Q 76.6 8.9 82.5 5.2 Q 88.4 1.5 95.3 1.5 Q 96.6 1.5 97.9 1.6 L 97.9 2.6 A 16.817 16.817 0 0 0 93.139 3.355 A 14.363 14.363 0 0 0 89.5 5.1 A 374.405 374.405 0 0 1 88.145 6.094 Q 87.075 6.875 86.2 7.5 A 10.962 10.962 0 0 0 85.281 8.242 Q 84.222 9.188 82.95 10.7 Q 81.1 12.9 80.25 13.9 Q 79.467 14.821 77.836 17.056 A 183.627 183.627 0 0 0 77.55 17.45 A 520.533 520.533 0 0 1 76.907 18.334 Q 75.625 20.094 75.3 20.5 L 53.7 50.1 L 73 80.4 Q 74.8 82.9 77.45 84.55 Q 80.1 86.2 83.1 86.2 Z M 173.8 0 L 173.8 1 A 26.943 26.943 0 0 0 166.197 2.02 A 20.514 20.514 0 0 0 156.4 8.25 A 23.429 23.429 0 0 0 151.714 16.746 Q 150.589 20.266 150.203 24.529 A 51.737 51.737 0 0 0 150 29.2 L 150 62.5 Q 150 74.2 142.6 81.4 A 24.873 24.873 0 0 1 129.602 87.998 A 35.657 35.657 0 0 1 122.9 88.6 Q 110.6 88.6 102.95 81.45 A 23.775 23.775 0 0 1 95.469 65.973 A 32.916 32.916 0 0 1 95.3 62.6 L 95.3 23.1 Q 95.3 20.2 92.7 18.8 Q 91.5 18.2 90 18.2 L 88.4 18.2 L 88.4 17.2 L 108.7 17.2 L 108.7 18.2 L 107.1 18.2 A 5.925 5.925 0 0 0 105.191 18.497 A 5.092 5.092 0 0 0 103.4 19.55 Q 101.9 20.9 101.8 23 L 101.8 61.2 A 33.002 33.002 0 0 0 102.621 68.768 A 22.712 22.712 0 0 0 107.65 78.75 Q 113.5 85.4 123 85.4 A 26.23 26.23 0 0 0 130.247 84.448 A 19.854 19.854 0 0 0 139.2 79.1 A 21.262 21.262 0 0 0 144.87 67.69 A 30.021 30.021 0 0 0 145.3 62.5 L 145.3 29.3 A 46.169 46.169 0 0 1 145.992 21.029 Q 147.57 12.376 152.75 7.3 A 25.209 25.209 0 0 1 167.449 0.301 A 34.788 34.788 0 0 1 172.1 0 L 173.8 0 Z";

const ParticleEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isTouchingRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    updateCanvasSize();

    let particles: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      color: string;
      scatteredColor: string;
      life: number;
      isPages: boolean;
    }[] = [];

    let textImageData: ImageData | null = null;

    function createTextImage() {
      if (!ctx || !canvas) return 0;

      ctx.fillStyle = "white";
      ctx.save();

      const logoHeight = isMobile ? 40 : 120;
      const haimingLogoWidth = logoHeight * (600 / 140); // Maintain aspect ratio
      const pagesLogoWidth = logoHeight * (270 / 140); // Maintain aspect ratio
      const logoSpacing = isMobile ? 2 : 10; // Increased gap for mobile and desktop
      const totalWidth = haimingLogoWidth + pagesLogoWidth + logoSpacing;

      ctx.translate(
        canvas.width / 2 - totalWidth / 2,
        canvas.height / 2 - logoHeight / 2
      );

      // Draw Haiming logo
      ctx.save();
      const haimingScale = logoHeight / 140;
      ctx.scale(haimingScale, haimingScale);
      const haimingPath = new Path2D(HAIMING_LOGO_PATH);
      ctx.fill(haimingPath);
      ctx.restore();

      // Draw Pages logo
      ctx.save();
      ctx.translate(haimingLogoWidth + logoSpacing, 0);
      const pagesScale = logoHeight / 140;
      ctx.scale(pagesScale, pagesScale);
      const pagesPath = new Path2D(PAGES_LOGO_PATH);
      ctx.fill(pagesPath);
      ctx.restore();

      ctx.restore();

      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      return Math.max(haimingScale, pagesScale);
    }

    function createParticle(scale: number) {
      if (!ctx || !canvas || !textImageData) return null;

      const data = textImageData.data;

      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * canvas.width);
        const y = Math.floor(Math.random() * canvas.height);

        if (data[(y * canvas.width + x) * 4 + 3] > 128) {
          const logoHeight = isMobile ? 40 : 80;
          const haimingLogoWidth = logoHeight * (652 / 140);
          const pagesLogoWidth = logoHeight * (289 / 140);
          const logoSpacing = isMobile ? 30 : 60;
          const totalWidth = haimingLogoWidth + pagesLogoWidth + logoSpacing;
          const centerX = canvas.width / 2;
          const isPages =
            x >= centerX - totalWidth / 2 + haimingLogoWidth + logoSpacing;
          return {
            x: x,
            y: y,
            baseX: x,
            baseY: y,
            size: Math.random() * 1.5 + 0.5,
            color: "white",
            scatteredColor: isPages ? "#8B5CF6" : "#00EEFF",
            isPages: isPages,
            life: Math.random() * 100 + 50,
          };
        }
      }

      return null;
    }

    function createInitialParticles(scale: number) {
      const baseParticleCount = 4000; // Reduced count for better performance
      const particleCount = Math.floor(
        baseParticleCount *
          Math.sqrt((canvas.width * canvas.height) / (1920 * 1080))
      );
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(scale);
        if (particle) particles.push(particle);
      }
    }

    let animationFrameId: number;

    function animate(scale: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(10, 10, 27, 0.2)"; // space-dark with high transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const maxDistance = 200;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (
          distance < maxDistance &&
          (isTouchingRef.current || !("ontouchstart" in window))
        ) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * 40;
          const moveY = Math.sin(angle) * force * 40;
          p.x = p.baseX - moveX;
          p.y = p.baseY - moveY;

          ctx.fillStyle = p.scatteredColor;
        } else {
          p.x += (p.baseX - p.x) * 0.1;
          p.y += (p.baseY - p.y) * 0.1;
          ctx.fillStyle = "white";
        }

        ctx.fillRect(p.x, p.y, p.size, p.size);

        p.life--;
        if (p.life <= 0) {
          const newParticle = createParticle(scale);
          if (newParticle) {
            particles[i] = newParticle;
          } else {
            particles.splice(i, 1);
            i--;
          }
        }
      }

      const baseParticleCount = 4000;
      const targetParticleCount = Math.floor(
        baseParticleCount *
          Math.sqrt((canvas.width * canvas.height) / (1920 * 1080))
      );
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle(scale);
        if (newParticle) particles.push(newParticle);
      }

      animationFrameId = requestAnimationFrame(() => animate(scale));
    }

    const scale = createTextImage();
    createInitialParticles(scale);
    animate(scale);

    const handleResize = () => {
      updateCanvasSize();
      const newScale = createTextImage();
      particles = [];
      createInitialParticles(newScale);
    };

    const handleMove = (x: number, y: number) => {
      mousePositionRef.current = { x, y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleMove(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        handleMove(
          e.touches[0].clientX - rect.left,
          e.touches[0].clientY - rect.top
        );
      }
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      mousePositionRef.current = { x: 0, y: 0 };
    };

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  return (
    <div className="relative w-full h-40 md:h-96 mt-16 overflow-hidden rounded-lg border border-neon-purple/20">
      <canvas
        ref={canvasRef}
        className="w-full h-full absolute top-0 left-0 touch-none"
        aria-label="Interactive particle effect with Haiming and Pages logos"
      />
    </div>
  );
};

export default ParticleEffect;
