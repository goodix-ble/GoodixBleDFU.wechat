// circular-progress-dialog.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    imageUrl: {
      type: String,
      value: ''
    },
    progress: {
      type: Number,
      value: 0,
      observer: '_drawProgress'
    }
  },
  methods: {
    _drawProgress: function(progress) {
      if (!this.data.show) return; // 不显示时不绘制
      
      const ctx = wx.createCanvasContext('progressCanvas', this);

      const radius = 70; // 圆半径
      const lineWidth = 10; // 圆环宽度
      const centerX = radius + lineWidth / 2; // 圆心 X 坐标
      const centerY = radius + lineWidth / 2; // 圆心 Y 坐标

      // 清空画布
      ctx.clearRect(0, 0, 2 * radius + lineWidth, 2 * radius + lineWidth);

      // 绘制背景圆环
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.setStrokeStyle('#ccc');
      ctx.setLineWidth(lineWidth);
      ctx.stroke();

      // 绘制进度圆环
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, -Math.PI / 2, 2 * Math.PI * progress / 100 - Math.PI / 2);
      ctx.setStrokeStyle('#007bff');
      ctx.setLineWidth(lineWidth);
      ctx.stroke();

      // 绘制
      ctx.draw();
    }
  }
})
