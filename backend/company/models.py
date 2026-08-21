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
