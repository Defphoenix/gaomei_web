from django.db import models


class CompanyInfo(models.Model):
    name = models.CharField("公司名称", max_length=200)
    slogan = models.CharField("标语", max_length=300, blank=True)
    description = models.TextField("公司介绍")
    mission = models.TextField("使命", blank=True)
    vision = models.TextField("愿景", blank=True)
    email = models.EmailField("邮箱", blank=True)
    phone = models.CharField("电话", max_length=20, blank=True)
    address = models.CharField("地址", max_length=300, blank=True)
    wechat = models.CharField("微信公众号", max_length=100, blank=True)
    founded_year = models.IntegerField("成立年份", null=True, blank=True)

    class Meta:
        verbose_name = "公司信息"
        verbose_name_plural = "公司信息"

    def __str__(self):
        return self.name


class TeamMember(models.Model):
    name = models.CharField("姓名", max_length=100)
    position = models.CharField("职位", max_length=100)
    bio = models.TextField("简介", blank=True)
    expertise = models.CharField("专业方向", max_length=300, blank=True, help_text="多个标签使用中文逗号分隔")
    is_active = models.BooleanField("首页展示", default=True)
    photo = models.ImageField("照片", upload_to="team/", blank=True, null=True)
    order = models.IntegerField("排序", default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name = "团队成员"
        verbose_name_plural = "团队成员"

    def __str__(self):
        return f"{self.name} - {self.position}"


class Service(models.Model):
    title = models.CharField("服务名称", max_length=200)
    description = models.TextField("服务描述")
    icon = models.CharField("图标(Font Awesome)", max_length=50, default="fas fa-flask")
    order = models.IntegerField("排序", default=0)
    is_active = models.BooleanField("是否展示", default=True)

    class Meta:
        ordering = ["order"]
        verbose_name = "服务项目"
        verbose_name_plural = "服务项目"

    def __str__(self):
        return self.title


class ContactMessage(models.Model):
    CATEGORY_CHOICES = [
        ("research", "科研合作"),
        ("product", "检测产品"),
        ("interpret", "产品解读"),
        ("deploy", "私有化部署"),
        ("career", "加入我们"),
        ("other", "其他留言"),
    ]
    STATUS_CHOICES = [
        ("new", "未读"),
        ("read", "已读"),
        ("done", "已处理"),
    ]

    name = models.CharField("姓名", max_length=80)
    phone = models.CharField("联系电话", max_length=40)
    category = models.CharField("咨询类型", max_length=20, choices=CATEGORY_CHOICES, default="product")
    product = models.CharField("产品方向", max_length=120, blank=True)
    content = models.TextField("留言内容")
    status = models.CharField("状态", max_length=10, choices=STATUS_CHOICES, default="new")
    admin_note = models.CharField("处理备注", max_length=300, blank=True)
    created_at = models.DateTimeField("提交时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "官网留言"
        verbose_name_plural = "官网留言"

    def __str__(self):
        return f"{self.name} · {self.phone} · {self.get_category_display()}"
