// 기본 공간 3곳의 최적 배치 (node로 미리 계산: env-opt.js O.solve, seed 7). 크기를 바꾸면 화면에서 다시 계산한다
(function (S) {
  S.ENV_PRESETS = {
    "A": {
      "dims": {
        "w": 6,
        "l": 8,
        "h": 3
      },
      "sel": [
        {
          "ci": 12,
          "hi": 1
        },
        {
          "ci": 34,
          "hi": 0
        },
        {
          "ci": 48,
          "hi": 1
        },
        {
          "ci": 69,
          "hi": 1
        },
        {
          "ci": 89,
          "hi": 0
        },
        {
          "ci": 103,
          "hi": 0
        }
      ],
      "J": 1.313
    },
    "B": {
      "dims": {
        "w": 7,
        "l": 9,
        "h": 3
      },
      "sel": [
        {
          "ci": 9,
          "hi": 0
        },
        {
          "ci": 19,
          "hi": 1
        },
        {
          "ci": 53,
          "hi": 1
        },
        {
          "ci": 72,
          "hi": 0
        },
        {
          "ci": 84,
          "hi": 0
        },
        {
          "ci": 116,
          "hi": 1
        }
      ],
      "J": 10.954
    },
    "C": {
      "dims": {
        "w": 2.4,
        "l": 20,
        "h": 2.7
      },
      "sel": [
        {
          "ci": 25,
          "hi": 1
        },
        {
          "ci": 50,
          "hi": 1
        },
        {
          "ci": 79,
          "hi": 0
        },
        {
          "ci": 114,
          "hi": 0
        },
        {
          "ci": 140,
          "hi": 1
        },
        {
          "ci": 169,
          "hi": 0
        }
      ],
      "J": 3.386
    }
  };
})(typeof window !== 'undefined' ? (window.SIM = window.SIM || {}) : module.exports);
