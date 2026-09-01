from django.db import models
from django.contrib.auth.models import User


class BioCategory(models.Model):
    name = models.CharField("分类名称", max_length=50)
    slug = models.SlugField("URL标识", max_length=50, unique=True)
    description = models.TextField("描述", blank=True)
    order = models.IntegerField("排序", default=0)
    icon = models.CharField("图标类名", max_length=50, blank=True, default="fas fa-flask")
    color = models.CharField("主题色", max_length=20, blank=True, default="#667eea")

    class Meta:
        ordering = ["order", "name"]
        verbose_name = "生信分类"
        verbose_name_plural = "生信分类"

    def __str__(self):
        return self.name


class BioTag(models.Model):
    name = models.CharField("标签名称", max_length=50)
    slug = models.SlugField("URL标识", max_length=50, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "生信标签"
        verbose_name_plural = "生信标签"

    def __str__(self):
        return self.name


class BioPost(models.Model):
    title = models.CharField("标题", max_length=200)
    slug = models.SlugField("URL标识", max_length=200, unique=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="作者")
    category = models.ForeignKey(BioCategory, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="分类")
    tags = models.ManyToManyField(BioTag, blank=True, verbose_name="标签")
    content = models.TextField("内容 (支持LaTeX)", blank=True, default="",
                               help_text="使用 $$...$$ 或 $...$ 包裹 LaTeX 公式")
    summary = models.TextField("摘要", max_length=500, blank=True)
    featured_image = models.ImageField("封面图片", upload_to="bioblog/", blank=True, null=True)
    status = models.CharField("状态", max_length=10, choices=[("draft", "草稿"), ("published", "已发布")], default="draft")
    views = models.IntegerField("浏览量", default=0)
    is_pinned = models.BooleanField("置顶", default=False)
    published_at = models.DateTimeField("发布时间", null=True, blank=True)
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-published_at"]
        verbose_name = "生信文章"
        verbose_name_plural = "生信文章"

    def __str__(self):
        return self.title


class BioComment(models.Model):
    post = models.ForeignKey(BioPost, on_delete=models.CASCADE, related_name="comments", verbose_name="文章")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bio_comments", verbose_name="作者")
    content = models.TextField("评论内容", max_length=2000)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies", verbose_name="回复")
    created_at = models.DateTimeField("创建时间", auto_now_add=True)
    updated_at = models.DateTimeField("更新时间", auto_now=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "生信讨论"
        verbose_name_plural = "生信讨论"

    def __str__(self):
        return f"{self.author.username}: {self.content[:30]}"
